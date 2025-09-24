import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createMessage, type Message, type MessageTypeMap } from './messages';
import { WebSocket } from 'ws';

interface InternalSubscription {
    id: number;
    topic: string;
    payload: Message<any>;
    callback: (data: string | null) => void;
    isOneTime: boolean;
}

interface SavedCookieData {
    trSessionToken: string;
    trRefreshToken?: string;
    rawCookies: string[];
}

const DEFAULT_COOKIE_FILE_NAME = ".tr_api_cookies.json";
const WS_CONNECTION_TIMEOUT_MS = 10_000;
const SESSION_VALIDATION_TIMEOUT_MS = 7_000;
const ECHO_INTERVAL_MS = 30_000;
const HTTP_TIMEOUT_MS = 10_000;

export class TradeRepublicApi {
    private static readonly HOST = "https://api.traderepublic.com" as const;
    private static readonly WS_HOST = "wss://api.traderepublic.com" as const;
    private static readonly WS_CONNECT_VERSION = "31" as const;

    private ws?: WebSocket;
    private trSessionToken?: string;
    private trRefreshToken?: string;
    private rawCookies: string[] = [];
    private processId?: string;

    private subscriptions: InternalSubscription[] = [];
    private nextSubscriptionId = 1;

    private echoIntervalId?: Timer;

    private readonly cookieFilePath: string;

    private reconnectAttempts = 0;
    private pendingSubs: Array<() => void> = [];

    /**
     * Initializes a new instance of the TradeRepublicApi
     * @param phoneNo The phone number associated with the Trade Republic account
     * @param pin The PIN for the Trade Republic account
     * @param cookieStoragePath Optional path to store session cookies. Defaults to user's home directory
     */
    constructor(
        private readonly phoneNo: string,
        private readonly pin: string,
        cookieStoragePath?: string
    ) {
        if (cookieStoragePath) {
            this.cookieFilePath = path.resolve(cookieStoragePath);
        } else {
            this.cookieFilePath = path.join(os.homedir(), DEFAULT_COOKIE_FILE_NAME);
        }
    }

    /**
     * Logs into Trade Republic. It first attempts to use a saved session,
     * then falls back to a full login flow if necessary
     * @param getDevicePin callback that returns the device PIN sent to the phone
     */
    async login(getDevicePin: () => Promise<string> = this._askDevicePinFromStdin): Promise<boolean> {
        console.info("Attempting to log in...");
        try {
            if (await this.loadAndValidateSavedSession()) {
                console.log("Successfully logged in using saved session. WebSocket setup completed.");
                return true;
            }

            console.info("Saved session invalid or not found. Performing full login...");
            const loginData = await this._performInitialLoginStep();

            if (!loginData.processId) {
                throw new Error("Login failed: no processId received from initial login step.");
            }
            this.processId = loginData.processId;

            const devicePin = await getDevicePin();
            await this._verifyDevicePin(devicePin);
            await this._saveSessionToFile();
            await this._setupWebSocket();
            console.log("Login successful via full flow and WebSocket setup completed.");
            return true;
        } catch (error) {
            console.error("Login failed:", error instanceof Error ? error.message : error);
            await this._clearSessionAndConnection(false);
            return false;
        }
    }

    /**
     * Performs the initial step of the login process to get a processId
     */
    private async _performInitialLoginStep(): Promise<{ processId?: string;[key: string]: any }> {
        const response = await this._request("/api/v1/auth/web/login", {
            phoneNumber: this.phoneNo,
            pin: this.pin
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Initial login request failed with status ${response.status}: ${errorBody}`);
        }
        return await response.json();
    }

    /**
     * Verifies the device PIN
     * @param devicePin The PIN received on the user's device
     */
    private async _verifyDevicePin(devicePin: string): Promise<void> {
        if (!this.processId) {
            throw new Error("Cannot verify PIN without a processId. Login flow corrupted.");
        }
        const response = await this._request(`/api/v1/auth/web/login/${this.processId}/${devicePin}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Device PIN verification failed with status ${response.status}: ${errorBody}`);
        }

        const anyHeaders = response.headers as any;
        const getSetCookie = anyHeaders.getSetCookie?.bind(response.headers);
        if (typeof getSetCookie === "function") {
            this.rawCookies = getSetCookie() as string[];
        } else {
            const single = response.headers.get("set-cookie");
            this.rawCookies = single ? single.split(/,(?=\s*[A-Za-z0-9_\-]+=)/g) : [];
        }

        this.trSessionToken = this._extractCookieValue("tr_session", true);
        this.trRefreshToken = this._extractCookieValue("tr_refresh", false);

        if (!this.trSessionToken) {
            throw new Error("Critical: tr_session token not extracted after PIN verification.");
        }
    }

    /**
     * Sets up the WebSocket connection
     */
    private async _setupWebSocket(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.info("WebSocket already connected.");
            return;
        }

        await this._closeWebSocket();
        this._clearEchoInterval();

        console.info(`Attempting to connect to WebSocket at ${TradeRepublicApi.WS_HOST}`);
        this.ws = new WebSocket(TradeRepublicApi.WS_HOST);

        await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.ws?.removeAllListeners();
                this.ws?.terminate();
                this.ws = undefined;
                reject(new Error(`WebSocket connection timed out after ${WS_CONNECTION_TIMEOUT_MS / 1000}s`));
            }, WS_CONNECTION_TIMEOUT_MS);

            const onOpen = () => {
                clearTimeout(timeoutId);
                this.ws?.off("error", onError);

                console.info("WebSocket connection opened.");
                const connectionMessage = { locale: "en" };
                this.ws!.send(`connect ${TradeRepublicApi.WS_CONNECT_VERSION} ${JSON.stringify(connectionMessage)}`);

                this._startEcho();
                this.reconnectAttempts = 0;
                this._flushPendingSubs();
                this._resubscribeAll();

                resolve();
            };

            const onMessage = (data: Buffer | string) => {
                this._handleWebSocketMessage(data.toString());
            };

            const onClose = (code: number, reason: Buffer) => {
                console.info(`WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`);
                this._clearEchoInterval();
                this._scheduleReconnect();
            };

            const onError = (err: Error) => {
                clearTimeout(timeoutId);
                this.ws?.off("open", onOpen);
                this.ws?.off("message", onMessage);
                console.error("WebSocket setup error:", err.message);
                this.ws?.terminate();
                this.ws = undefined;
                this._scheduleReconnect();
                reject(err);
            };

            this.ws?.once("open", onOpen);
            this.ws?.on("message", onMessage);
            this.ws?.once("error", onError);
            this.ws?.once("close", onClose);
        });
    }

    /**
     * Gracefully closes the WebSocket connection and clears related resources
     */
    private async _closeWebSocket(): Promise<void> {
        this._clearEchoInterval();
        if (this.ws) {
            const state = this.ws.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
                console.info("Closing WebSocket connection...");
                this.ws.removeAllListeners();
                const closePromise = new Promise<void>((resolve) => {
                    this.ws!.once("close", () => {
                        console.info("WebSocket connection confirmed closed.");
                        resolve();
                    });
                    this.ws!.close();
                });

                await Promise.race([
                    closePromise,
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                                console.warn("WebSocket close timed out, terminating.");
                                this.ws.terminate();
                            }
                            resolve();
                        }, 2_000);
                    })
                ]);
            } else if (state === WebSocket.CLOSING) {
                await new Promise<void>((resolve) => this.ws!.once("close", resolve));
            }
            this.ws = undefined;
        }
    }

    /**
     * Makes an HTTP request to the Trade Republic API with timeout and optional cookies
     */
    private async _request(
        urlPath: string,
        payload: any = null,
        method: string = "POST",
        sendAuthCookies: boolean = false
    ): Promise<Response> {
        const headers: HeadersInit = { "Content-Type": "application/json" };

        if (sendAuthCookies && this.rawCookies.length > 0) {
            headers["Cookie"] = this.rawCookies.map((c) => c.split(";")[0]).join("; ");
        }

        const options: RequestInit = {
            method,
            headers,
            body: method === "GET" || method === "DELETE" || !payload ? undefined : JSON.stringify(payload)
        };

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
        try {
            return await fetch(`${TradeRepublicApi.HOST}${urlPath}`, { ...options, signal: ctrl.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Asks a question to the user via the console
     */
    private _askDevicePinFromStdin = async (): Promise<string> => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise<string>((resolve) => {
            rl.question("Please enter the PIN received on your phone: ", (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    };

    /**
     * Extracts a specific cookie value from the raw cookies
     */
    private _extractCookieValue(name: string, required = true): string | undefined {
        const joined = this.rawCookies.join("; ");
        const match = joined.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
        const val = match?.[1];
        if (!val && required) throw new Error(`Required cookie not found: ${name}`);
        return val;
    }

    /**
     * Subscribe to a topic. Returns the subscription id
     */
    public subscribe<T extends keyof MessageTypeMap>(
        message: Message<T>,
        callback: (data: string | null) => void
    ): number {
        return this._subscribeInternal(message, callback, false);
    }

    /**
     * Subscribe once to a topic. Returns the subscription id
     */
    public subscribeOnce<T extends keyof MessageTypeMap>(
        message: Message<T>,
        callback: (data: string | null) => void
    ): number {
        return this._subscribeInternal(message, callback, true);
    }

    /**
     * Unsubscribe by id
     */
    public unsubscribe(id: number): void {
        this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(`unsub ${id}`);
            } catch (err) {
                console.warn("Failed to send unsub:", (err as Error).message);
            }
        }
    }

    private _subscribeInternal<T extends keyof MessageTypeMap>(
        message: Message<T>,
        callback: (data: string | null) => void,
        isOneTime: boolean
    ): number {
        if (!this.trSessionToken) {
            console.error("Session token is not available. Cannot subscribe.");
            return -1;
        }

        const subId = this.nextSubscriptionId++;
        const send = () => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.error("WebSocket connection not established or not open. Cannot subscribe now.");
                return;
            }
            try {
                this.ws.send(`sub ${subId} ${JSON.stringify({ token: this.trSessionToken, ...message })}`);
            } catch (error) {
                console.error("Failed to send subscription:", error instanceof Error ? error.message : error);
            }
        };

        this.subscriptions.push({
            id: subId,
            topic: message.type,
            payload: message,
            callback,
            isOneTime
        });

        if (this.ws?.readyState === WebSocket.OPEN) {
            send();
        } else {
            this.pendingSubs.push(send);
        }

        return subId;
    }

    private _flushPendingSubs(): void {
        if (!this.pendingSubs.length) return;
        const queue = this.pendingSubs.splice(0);
        for (const fn of queue) {
            try {
                fn();
            } catch (e) {
                console.warn("Error flushing pending subscription:", (e as Error).message);
            }
        }
    }

    private _resubscribeAll(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        for (const s of this.subscriptions) {
            try {
                this.ws.send(`sub ${s.id} ${JSON.stringify({ token: this.trSessionToken, ...s.payload })}`);
            } catch (e) {
                console.warn(`Failed to resubscribe ${s.id}:${s.topic}`, (e as Error).message);
            }
        }
    }

    private _scheduleReconnect(): void {
        const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts++);
        setTimeout(async () => {
            try {
                await this._setupWebSocket();
            } catch { }
        }, delay);
    }

    private _startEcho(): void {
        if (this.echoIntervalId) {
            clearInterval(this.echoIntervalId);
        }
        this.echoIntervalId = setInterval(() => this._sendEcho(), ECHO_INTERVAL_MS);
    }

    private _clearEchoInterval(): void {
        if (this.echoIntervalId) {
            clearInterval(this.echoIntervalId);
            this.echoIntervalId = undefined;
        }
    }

    private _sendEcho(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("Cannot send echo, WebSocket not open.");
            return;
        }
        try {
            const echoPayload = `echo ${Date.now()}`;
            this.ws.send(echoPayload);
        } catch (error) {
            console.error("Failed to send echo:", error instanceof Error ? error.message : error);
        }
    }

    private _handleWebSocketMessage(rawMessage: string): void {
        if (rawMessage.startsWith("echo")) {
            return;
        }
        if (rawMessage.startsWith("connected")) {
            console.info("WebSocket acknowledged connection:", rawMessage);
            return;
        }

        const parsed = this._parseWebSocketPayload(rawMessage);
        if (!parsed) {
            return;
        }

        const { subscriptionId, jsonData } = parsed;

        if (subscriptionId === null) {
            if (rawMessage.includes("failed") || rawMessage.includes("error")) {
                console.warn("Received unhandled or general error message from WebSocket:", rawMessage);
            }
            return;
        }

        const subIndex = this.subscriptions.findIndex((sub) => sub.id === subscriptionId);

        if (subIndex !== -1) {
            const subscription = this.subscriptions[subIndex];
            try {
                subscription.callback(jsonData);
            } catch (e) {
                console.error(
                    `Error in subscription callback for ID ${subscriptionId}, topic ${subscription.topic}:`,
                    e instanceof Error ? e.message : e
                );
            }

            if (subscription.isOneTime) {
                this.subscriptions.splice(subIndex, 1);
            }
        }
    }

    /**
     * Parses a raw WebSocket message string into its ID and JSON payload
     */
    private _parseWebSocketPayload(
        rawMessage: string
    ): { subscriptionId: number | null; jsonData: string | null } | null {
        const startIndex = rawMessage.indexOf("{");
        if (startIndex !== -1) {
            const idPart = rawMessage.substring(0, startIndex).trim();
            const idMatch = idPart.match(/\d+/);
            const subscriptionId = idMatch ? Number(idMatch[0]) : null;
            const jsonData = rawMessage.substring(startIndex).trim();
            return { subscriptionId, jsonData };
        } else {
            return { subscriptionId: null, jsonData: null };
        }
    }

    /**
     * Saves the current session (tokens and cookies) to a file
     */
    private async _saveSessionToFile(): Promise<void> {
        if (this.trSessionToken && this.rawCookies.length > 0) {
            const cookieData: SavedCookieData = {
                trSessionToken: this.trSessionToken,
                trRefreshToken: this.trRefreshToken,
                rawCookies: this.rawCookies
            };
            try {
                await fs.mkdir(path.dirname(this.cookieFilePath), { recursive: true });
                await fs.writeFile(this.cookieFilePath, JSON.stringify(cookieData, null, 2), {
                    encoding: "utf-8",
                    mode: 0o600
                });
                console.info("Session data saved to:", this.cookieFilePath);
            } catch (err) {
                console.error("Error saving session data to file:", this.cookieFilePath, err);
            }
        } else {
            console.warn("No session token or raw cookies to save. Skipping save.");
        }
    }

    /**
     * Loads session data from the cookie file
     */
    private async _loadSessionFromFile(): Promise<SavedCookieData | null> {
        try {
            await fs.access(this.cookieFilePath);
        } catch (err: any) {
            if (err.code === "ENOENT") {
                console.info("Session file not found. A new session will be created if login proceeds.");
            } else {
                console.warn("Error accessing session file (permissions?):", this.cookieFilePath, err.message);
            }
            return null;
        }

        try {
            const data = await fs.readFile(this.cookieFilePath, "utf-8");
            if (!data.trim()) {
                console.warn("Session file is empty. Will be overwritten on next successful login.");
                await this._deleteSavedSessionFile();
                return null;
            }
            const parsed: SavedCookieData = JSON.parse(data);

            if (parsed.trSessionToken && Array.isArray(parsed.rawCookies)) {
                console.info("Session data loaded from:", this.cookieFilePath);
                return parsed;
            }

            console.warn("Loaded session file is malformed (missing token or rawCookies). It will be overwritten.");
            await this._deleteSavedSessionFile();
            return null;
        } catch (err: any) {
            console.warn("Error loading/parsing session data from file:", this.cookieFilePath, err.message);
            await this._deleteSavedSessionFile();
            return null;
        }
    }

    /**
     * Attempts to load a saved session and validate it via WebSocket
     */
    private async loadAndValidateSavedSession(): Promise<boolean> {
        const savedData = await this._loadSessionFromFile();
        if (!savedData?.trSessionToken) {
            return false;
        }

        this.trSessionToken = savedData.trSessionToken;
        this.trRefreshToken = savedData.trRefreshToken;
        this.rawCookies = savedData.rawCookies;

        console.info("Loaded session from file. Validating session via WebSocket...");

        try {
            await this._setupWebSocket();

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.warn("WebSocket not open after setup attempt during saved session validation.");
                await this._clearSessionAndConnection(true);
                return false;
            }

            const isSessionValid = await this._performSessionValidationSubscription();

            if (isSessionValid) {
                console.info("Saved session is valid and WebSocket is ready.");
                return true;
            } else {
                console.warn("Saved session validation failed (token likely expired or invalid).");
                await this._clearSessionAndConnection(true);
                return false;
            }
        } catch (error: any) {
            console.warn("Error during saved session validation or WebSocket setup:", error.message || error);
            await this._clearSessionAndConnection(true);
            return false;
        }
    }

    /**
     * Performs a lightweight subscription to check if the current session token is valid
     */
    private _performSessionValidationSubscription(): Promise<boolean> {
        const validationMessage = createMessage("availableCash");

        return new Promise<boolean>((resolve) => {
            let timeoutId: Timer | null = null;
            let hasResolved = false;

            const cleanupAndResolve = (isValid: boolean) => {
                if (hasResolved) return;
                hasResolved = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                resolve(isValid);
            };

            try {
                this.subscribeOnce(validationMessage, (data) => {
                    if (data === null) {
                        console.warn("Session validation subscription received null data string. Assuming invalid.");
                        cleanupAndResolve(false);
                        return;
                    }
                    try {
                        if (data.includes("AUTHENTICATION_ERROR")) {
                            console.warn("Session validation subscription indicated an error:", data);
                            cleanupAndResolve(false);
                        } else {
                            console.info("Session validation subscription successful.");
                            cleanupAndResolve(true);
                        }
                    } catch (e) {
                        console.warn(
                            "Error parsing payload during session validation:",
                            e instanceof Error ? e.message : e,
                            "Raw data:",
                            data
                        );
                        cleanupAndResolve(false);
                    }
                });
            } catch (e) {
                console.error("Error initiating session validation subscription:", e instanceof Error ? e.message : e);
                cleanupAndResolve(false);
            }

            timeoutId = setTimeout(() => {
                if (!hasResolved) {
                    console.warn(`Session validation subscription timed out after ${SESSION_VALIDATION_TIMEOUT_MS / 1000}s.`);
                    cleanupAndResolve(false);
                }
            }, SESSION_VALIDATION_TIMEOUT_MS);
        });
    }

    /**
     * Clears all local state (tokens, cookies, processId, WebSocket, timers)
     * Does NOT clear the persisted cookie file
     */
    private async _clearLocalRuntimeState(): Promise<void> {
        console.debug("Clearing local runtime state...");
        this.trSessionToken = undefined;
        this.trRefreshToken = undefined;
        this.rawCookies = [];
        this.processId = undefined;
        this.subscriptions = [];
        this.nextSubscriptionId = 1;
        this.pendingSubs = [];
        await this._closeWebSocket();
    }

    /**
     * Deletes the saved session file from disk
     */
    private async _deleteSavedSessionFile(): Promise<void> {
        try {
            await fs.access(this.cookieFilePath);
            await fs.unlink(this.cookieFilePath);
            console.info("Saved session file deleted:", this.cookieFilePath);
        } catch (err: any) {
            if (err.code === "ENOENT") {
                // ignore
            } else {
                console.error("Error deleting saved session file:", this.cookieFilePath, err.message);
            }
        }
    }

    /**
     * Clears local runtime state and optionally the persisted session file
     */
    private async _clearSessionAndConnection(deletePersistedSessionFile: boolean): Promise<void> {
        await this._clearLocalRuntimeState();
        if (deletePersistedSessionFile) {
            await this._deleteSavedSessionFile();
        }
    }

    /**
     * Logs out by clearing local state and the saved session file
     */
    public async logout(): Promise<void> {
        console.info("Logging out and clearing session...");
        await this._clearSessionAndConnection(true);
        console.info("Local session cleared, saved session file deleted, and WebSocket closed.");
    }
}
