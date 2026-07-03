import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { createMessage, type Message, type MessageTypeMap, type MessageResponseMap } from './messages';
import { WebSocket } from 'ws';
import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Logging sink used throughout the library. Inject your own to control the
 * log level / destination, or pass {@link silentLogger} to disable logging
 * Defaults to the global `console`
 */
export interface Logger {
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}

/** A {@link Logger} that discards everything. Use to silence the library */
export const silentLogger: Logger = {
    debug() { },
    info() { },
    warn() { },
    error() { },
};

interface InternalSubscription {
    id: number;
    topic: string;
    payload: Message<any>;
    callback: (data: any | null) => void;
    isOneTime: boolean;
}

interface SavedCookieData {
    trSessionToken: string;
    trRefreshToken?: string;
    rawCookies: string[];
}

interface ParsedFrame {
    subscriptionId: number | null;
    code: string | null;
    payload: string;
}

/**
 * Events emitted by {@link TradeRepublicApi}:
 * - `open`               WebSocket is connected and ready.
 * - `close`              WebSocket closed (a reconnect may be scheduled).
 * - `reconnecting`       A reconnect attempt has been scheduled.
 * - `reconnect_failed`   Max reconnect attempts exhausted; the connection is dead.
 * - `error`              A non-fatal error occurred.
 */
type TradeRepublicEvents =
    | 'open'
    | 'close'
    | 'reconnecting'
    | 'reconnect_failed'
    | 'error';

const DEFAULT_COOKIE_FILE_NAME = ".tr_api_cookies.json";

const WS_CONNECTION_TIMEOUT_MS = 10_000;
const WS_CLOSE_TIMEOUT_MS = 2_000;
const SESSION_VALIDATION_TIMEOUT_MS = 7_000;
const ECHO_INTERVAL_MS = 30_000;
const HTTP_TIMEOUT_MS = 10_000;

const WAF_PAGE_LOAD_TIMEOUT_MS = 15_000;
const APP_CONFIRMATION_POLL_MS = 2_500;
const APP_CONFIRMATION_TIMEOUT_MS = 120_000;
const QR_CHALLENGE_POLL_MS = 2_000;
const QR_CHALLENGE_TIMEOUT_MS = 120_000;

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_APP_VERSION = "15.65.6";

export class TradeRepublicApi extends EventEmitter {
    private static readonly HOST = "https://api.traderepublic.com" as const;
    private static readonly WS_HOST = "wss://api.traderepublic.com" as const;
    private static readonly WS_CONNECT_VERSION = "34" as const;
    private static readonly MAX_RECONNECT_ATTEMPTS = 10;
    private static readonly REFRESH_ENDPOINT = "/api/v1/auth/web/session" as const;

    private ws?: WebSocket;
    private trSessionToken?: string;
    private trRefreshToken?: string;
    private rawCookies: string[] = [];
    private processId?: string;

    private subscriptions: InternalSubscription[] = [];
    private nextSubscriptionId = 1;
    private previousResponses = new Map<number, string>();

    private echoIntervalId?: ReturnType<typeof setInterval>;
    private reconnectTimer?: ReturnType<typeof setTimeout>;

    private readonly cookieFilePath: string;

    private reconnectAttempts = 0;
    private shouldReconnect = true;

    private browser?: Browser;
    private page?: Page;
    private currentWafToken?: string;
    private deviceInfo?: string;
    private trAppVersion?: string;

    private loginInFlight?: Promise<boolean>;
    private wafTokenInFlight?: Promise<string>;

    /**
     * Initializes a new instance of the TradeRepublicApi
     * @param phoneNo The phone number associated with the Trade Republic account. Optional when only {@link loginWithQrCode} is used
     * @param pin The PIN for the Trade Republic account. Optional when only {@link loginWithQrCode} is used
     * @param cookieStoragePath Optional path to store session cookies. Defaults to user's home directory
     * @param logger Optional logger sink. Defaults to the global `console`; pass {@link silentLogger} to disable logging
     */
    constructor(
        private readonly phoneNo?: string,
        private readonly pin?: string,
        cookieStoragePath?: string,
        private readonly logger: Logger = console
    ) {
        super();
        this.cookieFilePath = cookieStoragePath
            ? path.resolve(cookieStoragePath)
            : path.join(os.homedir(), DEFAULT_COOKIE_FILE_NAME);
    }

    public on(event: TradeRepublicEvents, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
    public once(event: TradeRepublicEvents, listener: (...args: any[]) => void): this {
        return super.once(event, listener);
    }
    public emit(event: TradeRepublicEvents, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    /**
     * Logs into Trade Republic. Attempts a saved session, then a token refresh,
     * then falls back to the full login flow. Re-entrant: concurrent calls share
     * the same in-flight promise.
     */
    async login(): Promise<boolean> {
        if (this.loginInFlight) {
            return this.loginInFlight;
        }

        this.loginInFlight = this._doLogin().finally(() => {
            this.loginInFlight = undefined;
        });

        return this.loginInFlight;
    }

    /**
     * Logs into Trade Republic using the QR-code flow instead of phone number + PIN.
     * 
     * @param onQrCode Invoked with the QR payload URL to display. May be called again if the QR token rotates before the user scans it.
     */
    async loginWithQrCode(onQrCode: (qrCodePayload: string) => void): Promise<boolean> {
        if (this.loginInFlight) {
            return this.loginInFlight;
        }

        this.loginInFlight = this._doQrLogin(onQrCode).finally(() => {
            this.loginInFlight = undefined;
        });

        return this.loginInFlight;
    }

    private async _doLogin(): Promise<boolean> {
        this.logger.info("Attempting to log in...");
        this.shouldReconnect = true;
        try {
            await this._getWafToken();

            if (await this._loadValidateOrRefreshSavedSession()) {
                this.logger.info("Logged in using a saved/refreshed session. WebSocket ready.");
                return true;
            }

            this.logger.info("No usable saved session. Performing full login...");
            const loginData = await this._performInitialLoginStep();

            if (!loginData.processId) {
                throw new Error("Login failed: no processId received from initial login step.");
            }
            this.processId = loginData.processId;

            const confirmResponse = await this._waitForAppConfirmation(this.processId);
            this._consumeSessionCookies(confirmResponse);

            await this._saveSessionToFile();
            await this._setupWebSocket();
            this.logger.info("Login successful via full flow. WebSocket ready.");
            return true;
        } catch (error) {
            this.logger.error("Login failed:", error instanceof Error ? error.message : error);
            await this._clearSessionAndConnection(false);
            return false;
        }
    }

    private async _doQrLogin(onQrCode: (qrCodePayload: string) => void): Promise<boolean> {
        this.logger.info("Attempting to log in via QR code...");
        this.shouldReconnect = true;
        try {
            await this._getWafToken();

            if (await this._loadValidateOrRefreshSavedSession()) {
                this.logger.info("Logged in using a saved/refreshed session. WebSocket ready.");
                return true;
            }

            this.logger.info("No usable saved session. Starting QR-code login...");
            const challenge = await this._createQrChallenge();

            const confirmResponse = await this._waitForQrConfirmation(challenge.challengeId, onQrCode);
            this._consumeSessionCookies(confirmResponse);

            await this._saveSessionToFile();
            await this._setupWebSocket();
            this.logger.info("Login successful via QR-code flow. WebSocket ready.");
            return true;
        } catch (error) {
            this.logger.error("QR-code login failed:", error instanceof Error ? error.message : error);
            await this._clearSessionAndConnection(false);
            return false;
        }
    }

    /**
     * Creates a QR login challenge. The returned `challengeId` is polled until the
     * user scans the QR code with their app.
     */
    private async _createQrChallenge(): Promise<{ challengeId: string; challengeExpiresAt: string }> {
        const response = await this._request("/api/v2/auth/web/login/qr-challenges", null, "POST");

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`QR challenge request failed with status ${response.status}: ${errorBody}`);
        }

        const data = (await response.json()) as { challengeId?: string; challengeExpiresAt?: string };
        if (!data.challengeId) {
            throw new Error("QR challenge failed: no challengeId received.");
        }

        return data as { challengeId: string; challengeExpiresAt: string };
    }

    /**
     * Polls the QR challenge until the user approves the login in their app.
     * 
     * @param challengeId The challengeId from {@link _createQrChallenge}
     * @param onQrCode Callback that receives the QR payload URL to display
     */
    private _waitForQrConfirmation(
        challengeId: string,
        onQrCode: (qrCodePayload: string) => void
    ): Promise<Response> {
        const deadline = Date.now() + QR_CHALLENGE_TIMEOUT_MS;
        let lastPayload: string | undefined;

        return new Promise<Response>((resolve, reject) => {
            const poll = async (): Promise<void> => {
                try {
                    if (Date.now() > deadline) {
                        return reject(new Error(
                            `QR-code login timed out after ${QR_CHALLENGE_TIMEOUT_MS / 1000}s. ` +
                            `Please scan the QR code with your Trade Republic app.`
                        ));
                    }

                    const checkResponse = await this._request(
                        `/api/v2/auth/web/login/qr-challenges/${challengeId}`,
                        null,
                        "GET"
                    );
                    if (!checkResponse.ok) {
                        const errorBody = await checkResponse.text();
                        return reject(new Error(
                            `Error while checking QR challenge status (${checkResponse.status}): ${errorBody}`
                        ));
                    }

                    const checkData = (await checkResponse.clone().json()) as {
                        status?: string;
                        qrCodePayload?: string | null;
                        processId?: string | null;
                    };

                    if (checkData.qrCodePayload && checkData.qrCodePayload !== lastPayload) {
                        lastPayload = checkData.qrCodePayload;
                        try {
                            onQrCode(checkData.qrCodePayload);
                        } catch (cbErr) {
                            this.logger.warn(
                                "QR code callback threw:",
                                cbErr instanceof Error ? cbErr.message : cbErr
                            );
                        }
                    }

                    if (checkData.processId) {
                        this.processId = checkData.processId;
                        return resolve(await this._waitForAppConfirmation(checkData.processId));
                    }

                    if (checkData.status && checkData.status !== "PENDING") {
                        if (checkData.status === "COMPLETED" || checkData.status === "CONFIRMED") {
                            return resolve(checkResponse);
                        }
                        return reject(new Error(
                            `QR-code login failed with status "${checkData.status}". Please try again.`
                        ));
                    }

                    setTimeout(poll, QR_CHALLENGE_POLL_MS);
                } catch (err) {
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            };

            poll();
        });
    }

    private async _getWafToken(forceRefresh = false): Promise<string> {
        if (this.currentWafToken && !forceRefresh) {
            return this.currentWafToken;
        }

        if (this.wafTokenInFlight) {
            return this.wafTokenInFlight;
        }

        this.wafTokenInFlight = this._fetchWafToken(forceRefresh).finally(() => {
            this.wafTokenInFlight = undefined;
        });

        return this.wafTokenInFlight;
    }

    private async _fetchWafToken(forceRefresh: boolean): Promise<string> {
        this.logger.info("Retrieving AWS WAF token via Puppeteer...");

        if (!this.browser || !this.page) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.page = await this.browser.newPage();

            this.page.on("request", request => {
                const headers = request.headers();
                const deviceInfo = headers["x-tr-device-info"];
                const appVersion = headers["x-tr-app-version"];
                if (deviceInfo) this.deviceInfo = deviceInfo;
                if (appVersion) this.trAppVersion = appVersion;
            });

            await this.page.setUserAgent(USER_AGENT);

            this.logger.info("Loading Trade Republic web app to bypass AWS WAF...");
            await this.page.goto('https://app.traderepublic.com', { waitUntil: 'networkidle2' });
        }

        await this.page.waitForFunction(
            'window.AwsWafIntegration !== undefined',
            { timeout: WAF_PAGE_LOAD_TIMEOUT_MS }
        );

        const token = await this.page.evaluate(async (force: boolean) => {
            // @ts-ignore
            const aws = window.AwsWafIntegration;
            if (force && typeof aws.forceRefreshToken === 'function') {
                return await aws.forceRefreshToken();
            }
            return await aws.getToken();
        }, forceRefresh);

        if (!token) {
            throw new Error("Failed to retrieve AWS WAF token from Puppeteer context.");
        }

        this.currentWafToken = token;
        return token;
    }

    /**
     * Performs the initial step of the login process to get a processId.
     */
    private async _performInitialLoginStep(): Promise<{ processId?: string;[key: string]: any }> {
        if (!this.phoneNo || !this.pin) {
            throw new Error(
                "Phone number and PIN are required for this login flow. " +
                "Provide them in the constructor, or use loginWithQrCode() instead."
            );
        }

        const response = await this._request("/api/v2/auth/web/login", {
            phoneNumber: this.phoneNo,
            pin: this.pin
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Initial login request failed with status ${response.status}: ${errorBody}`);
        }

        return (await response.json()) as { processId?: string;[key: string]: any };
    }

    /**
     * Polls the login status endpoint until the user confirms on their device
     * @param processId The processId from the initial login step
     */
    private _waitForAppConfirmation(processId: string): Promise<Response> {
        const deadline = Date.now() + APP_CONFIRMATION_TIMEOUT_MS;

        return new Promise<Response>((resolve, reject) => {
            const poll = async (): Promise<void> => {
                try {
                    if (this.processId !== processId) {
                        return reject(new Error("Process ID changed during confirmation wait. Login flow corrupted."));
                    }
                    if (Date.now() > deadline) {
                        return reject(new Error(
                            `App confirmation timed out after ${APP_CONFIRMATION_TIMEOUT_MS / 1000}s. ` +
                            `Please confirm the login on your phone.`
                        ));
                    }

                    const checkResponse = await this._request(`/api/v2/auth/web/login/processes/${processId}`, null, "GET");
                    if (!checkResponse.ok) {
                        const errorBody = await checkResponse.text();
                        return reject(new Error(
                            `Error while checking confirmation status (${checkResponse.status}): ${errorBody}`
                        ));
                    }

                    const checkData = await checkResponse.json();
                    if (checkData.status === "CONFIRMED") {
                        return resolve(checkResponse);
                    }
                    if (checkData.status !== "PENDING") {
                        return reject(new Error(
                            "Device confirmation failed during status check. Please check your phone and try again."
                        ));
                    }

                    setTimeout(poll, APP_CONFIRMATION_POLL_MS);
                } catch (err) {
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            };

            poll();
        });
    }

    /**
     * Extracts and stores the session tokens from a response's Set-Cookie headers.
     */
    private _consumeSessionCookies(response: Response): void {
        this.rawCookies = this._extractRawCookies(response);
        this.trSessionToken = this._extractCookieValue("tr_session", true);
        this.trRefreshToken = this._extractCookieValue("tr_refresh", false);

        if (!this.trSessionToken) {
            throw new Error("Critical: tr_session token not extracted after app verification.");
        }
    }

    /** Reads all Set-Cookie headers from a response across runtimes. */
    private _extractRawCookies(response: Response): string[] {
        const anyHeaders = response.headers as any;
        const getSetCookie = anyHeaders.getSetCookie?.bind(response.headers);
        
        if (typeof getSetCookie === "function") {
            return getSetCookie() as string[];
        }

        const single = response.headers.get("set-cookie");
        return single ? single.split(/,(?=\s*[A-Za-z0-9_\-]+=)/g) : [];
    }

    /**
     * Sets up the WebSocket connection.
     */
    private async _setupWebSocket(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logger.info("WebSocket already connected.");
            return;
        }

        await this._closeWebSocket();
        this._clearEchoInterval();

        this.logger.info(`Connecting to WebSocket at ${TradeRepublicApi.WS_HOST}...`);

        const wsHeaders: Record<string, string> = { "User-Agent": USER_AGENT };
        if (this.rawCookies.length > 0) {
            wsHeaders["Cookie"] = this._cookieHeader();
        }

        this.ws = new WebSocket(TradeRepublicApi.WS_HOST, { headers: wsHeaders });

        await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.ws?.removeAllListeners();
                this.ws?.terminate();
                this.ws = undefined;
                reject(new Error(`WebSocket connection timed out after ${WS_CONNECTION_TIMEOUT_MS / 1000}s`));
            }, WS_CONNECTION_TIMEOUT_MS);

            const onOpen = () => {
                clearTimeout(timeoutId);
                this.ws?.off("error", onErrorBeforeOpen);

                this.logger.info("WebSocket connection opened.");
                const connectionMessage = { locale: "en" };
                this.ws!.send(`connect ${TradeRepublicApi.WS_CONNECT_VERSION} ${JSON.stringify(connectionMessage)}`);

                this._startEcho();
                this.reconnectAttempts = 0;
                this.previousResponses.clear();
                this._resubscribeAll();

                this.emit('open');
                resolve();
            };

            const onMessage = (data: Buffer | string) => {
                this._handleWebSocketMessage(data.toString());
            };

            const onErrorBeforeOpen = (err: Error) => {
                clearTimeout(timeoutId);
                this.ws?.off("open", onOpen);
                this.ws?.off("message", onMessage);
                this.logger.error("WebSocket setup error:", err.message);
                this.emit('error', err);
                reject(err);
            };

            const onClose = (code: number, reason: Buffer) => {
                this.logger.info(`WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`);
                this._clearEchoInterval();
                this.emit('close', code, reason.toString());
                this._scheduleReconnect();
            };

            this.ws?.once("open", onOpen);
            this.ws?.on("message", onMessage);
            this.ws?.once("error", onErrorBeforeOpen);
            this.ws?.once("close", onClose);
        });
    }

    /**
     * Gracefully closes the WebSocket connection and clears related resources
     */
    private async _closeWebSocket(): Promise<void> {
        this._clearEchoInterval();
        
        if (!this.ws) 
            return;

        const state = this.ws.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
            this.logger.info("Closing WebSocket connection...");
            this.ws.removeAllListeners();
            const ws = this.ws;
            const closePromise = new Promise<void>((resolve) => {
                ws.once("close", () => {
                    this.logger.info("WebSocket connection confirmed closed.");
                    resolve();
                });
                ws.close();
            });

            await Promise.race([
                closePromise,
                new Promise<void>((resolve) => {
                    setTimeout(() => {
                        if (ws.readyState !== WebSocket.CLOSED) {
                            this.logger.warn("WebSocket close timed out, terminating.");
                            ws.terminate();
                        }
                        resolve();
                    }, WS_CLOSE_TIMEOUT_MS);
                })
            ]);
        } else if (state === WebSocket.CLOSING) {
            await new Promise<void>((resolve) => this.ws!.once("close", resolve));
        }
        this.ws = undefined;
    }

    private _cookieHeader(): string {
        return this.rawCookies.map((c) => c.split(";")[0]).join("; ");
    }

    /**
     * Makes an HTTP request to the Trade Republic API with timeout and cookies
     */
    private async _request(
        urlPath: string,
        payload: any = null,
        method: string = "POST",
        sendAuthCookies: boolean = false,
        isRetry: boolean = false
    ): Promise<Response> {
        const wafToken = await this._getWafToken();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-aws-waf-token": wafToken,
            "x-tr-platform": "web",
            "User-Agent": USER_AGENT,
            "x-tr-app-version": this.trAppVersion ?? DEFAULT_APP_VERSION,
        };

        if (this.deviceInfo) {
            headers["x-tr-device-info"] = this.deviceInfo;
        }

        if (sendAuthCookies && this.rawCookies.length > 0) {
            headers["Cookie"] = this._cookieHeader();
        }

        const options: RequestInit = {
            method,
            headers,
            body: method === "GET" || method === "DELETE" || !payload ? undefined : JSON.stringify(payload)
        };

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
        try {
            const response = await fetch(`${TradeRepublicApi.HOST}${urlPath}`, { ...options, signal: ctrl.signal });

            if (!isRetry && (response.status === 405 || response.status === 403)) {
                this.logger.warn(`Received ${response.status} from TR API. AWS token may be expired. Refreshing...`);
                await this._getWafToken(true);
                return await this._request(urlPath, payload, method, sendAuthCookies, true);
            }

            return response;
        } finally {
            clearTimeout(timer);
        }
    }

    private _extractCookieValue(name: string, required = true): string | undefined {
        const joined = this.rawCookies.join("; ");
        const match = joined.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
        const val = match?.[1];
        if (!val && required) throw new Error(`Required cookie not found: ${name}`);
        return val;
    }

    /**
     * Subscribe to a topic. The callback receives the parsed response
     * payload or null when the payload is empty
     * or could not be parsed. Returns the subscription id
     */
    public subscribe<T extends keyof MessageTypeMap>(
        message: Message<T>,
        callback: (data: MessageResponseMap[T] | null) => void
    ): number {
        return this._subscribeInternal(message, callback, false);
    }

    /**
     * Subscribe once to a topic. The callback receives the parsed response
     * payload, or null when the payload
     * is empty or could not be parsed. Returns the subscription id
     */
    public subscribeOnce<T extends keyof MessageTypeMap>(
        message: Message<T>,
        callback: (data: MessageResponseMap[T] | null) => void
    ): number {
        return this._subscribeInternal(message, callback, true);
    }

    /**
     * Unsubscribe by id
     */
    public unsubscribe(id: number): void {
        this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
        this.previousResponses.delete(id);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(`unsub ${id}`);
            } catch (err) {
                this.logger.warn("Failed to send unsub:", (err as Error).message);
            }
        }
    }

    private _subscribeInternal<T extends keyof MessageTypeMap>(
        message: Message<T>,
        callback: (data: MessageResponseMap[T] | null) => void,
        isOneTime: boolean
    ): number {
        if (!this.trSessionToken) {
            this.logger.error("Session token is not available. Cannot subscribe.");
            return -1;
        }

        const subId = this.nextSubscriptionId++;
        this.subscriptions.push({
            id: subId,
            topic: message.type,
            payload: message,
            callback,
            isOneTime
        });

        if (this.ws?.readyState === WebSocket.OPEN) {
            this._sendSub(subId, message);
        }

        return subId;
    }

    private _sendSub(id: number, payload: Message<any>): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.logger.error("WebSocket not open. Cannot send subscription now; will send on reconnect.");
            return;
        }

        try {
            this.ws.send(`sub ${id} ${JSON.stringify({ token: this.trSessionToken, ...payload })}`);
        } catch (error) {
            this.logger.error("Failed to send subscription:", error instanceof Error ? error.message : error);
        }
    }

    private _resubscribeAll(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) 
            return;

        for (const s of this.subscriptions) {
            this._sendSub(s.id, s.payload);
        }
    }

    private _scheduleReconnect(): void {
        if (!this.shouldReconnect) {
            return;
        }

        if (this.reconnectTimer) {
            return;
        }

        if (this.reconnectAttempts >= TradeRepublicApi.MAX_RECONNECT_ATTEMPTS) {
            this.logger.error("Max reconnect attempts reached. Giving up.");
            this.emit('reconnect_failed');
            return;
        }

        const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts++);
        this.logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay / 1000}s...`);
        this.emit('reconnecting', this.reconnectAttempts, delay);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = undefined;

            try {
                await this._setupWebSocket();
            } catch (err) {
                this.logger.warn("Reconnect failed:", (err as Error).message);
            }

        }, delay);
    }

    private _clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    private _startEcho(): void {
        this._clearEchoInterval();
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
            this.logger.warn("Cannot send echo, WebSocket not open.");
            return;
        }

        try {
            this.ws.send(`echo ${Date.now()}`);
        } catch (error) {
            this.logger.error("Failed to send echo:", error instanceof Error ? error.message : error);
        }
    }

    private _handleWebSocketMessage(rawMessage: string): void {
        if (rawMessage.startsWith("echo")) {
            return;
        }

        if (rawMessage.startsWith("connected")) {
            this.logger.info("WebSocket acknowledged connection.");
            return;
        }

        const frame = this._parseWebSocketPayload(rawMessage);
        if (frame.subscriptionId === null) {
            if (rawMessage.includes("failed") || rawMessage.includes("error")) {
                this.logger.warn("Received an unhandled/general WebSocket message (length:", rawMessage.length, ").");
            }
            return;
        }

        const subscription = this.subscriptions.find((sub) => sub.id === frame.subscriptionId);
        if (!subscription) {
            return;
        }

        const deliver = (raw: string | null) => {
            let parsed: unknown = null;
            if (raw) {
                try {
                    parsed = JSON.parse(raw);
                } catch (e) {
                    this.logger.warn(
                        `Failed to parse payload for subscription ${subscription.id}, topic ${subscription.topic}:`,
                        e instanceof Error ? e.message : e
                    );
                    parsed = null;
                }
            }
            try {
                subscription.callback(parsed);
            } catch (e) {
                this.logger.error(
                    `Error in subscription callback for ID ${subscription.id}, topic ${subscription.topic}:`,
                    e instanceof Error ? e.message : e
                );
            }
            if (subscription.isOneTime) {
                this.subscriptions = this.subscriptions.filter((s) => s.id !== subscription.id);
                this.previousResponses.delete(subscription.id);
            }
        };

        switch (frame.code) {
            case "A": {
                this.previousResponses.set(subscription.id, frame.payload);
                deliver(frame.payload);
                break;
            }
            case "D": {
                const previous = this.previousResponses.get(subscription.id) ?? "";
                const next = this._applyDelta(previous, frame.payload);
                this.previousResponses.set(subscription.id, next);
                deliver(next);
                break;
            }
            case "C": {
                break;
            }
            case "E": {
                this.logger.warn(`WebSocket error frame for subscription ${subscription.id}, topic ${subscription.topic}.`);
                deliver(frame.payload);
                break;
            }
            default: {
                deliver(frame.payload || null);
                break;
            }
        }
    }

    private _applyDelta(previous: string, delta: string): string {
        const out: string[] = [];
        let i = 0;
        for (const op of delta.split("\t")) {
            if (!op) continue;
            const sign = op[0];
            const rest = op.slice(1);
            if (sign === "=") {
                const len = parseInt(rest, 10);
                out.push(previous.slice(i, i + len));
                i += len;
            } else if (sign === "-") {
                i += parseInt(rest, 10);
            } else if (sign === "+") {
                out.push(rest);
            }
        }
        return out.join("");
    }

    /**
     * Parses a raw WebSocket message string into its ID and JSON payload
     */
    private _parseWebSocketPayload(rawMessage: string): ParsedFrame {
        const match = rawMessage.match(/^(\d+)\s+([A-Z])\s?([\s\S]*)$/);
        if (match) {
            return {
                subscriptionId: Number(match[1]),
                code: match[2],
                payload: match[3] ?? ""
            };
        }
        return { subscriptionId: null, code: null, payload: "" };
    }

    /**
     * Saves the current session (tokens and cookies) to a file
     */
    private async _saveSessionToFile(): Promise<void> {
        if (!this.trSessionToken || this.rawCookies.length === 0) {
            this.logger.warn("No session token or raw cookies to save. Skipping save.");
            return;
        }

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
            this.logger.info("Session data saved to:", this.cookieFilePath);
        } catch (err) {
            this.logger.error("Error saving session data to file:", this.cookieFilePath, err);
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
                this.logger.info("Session file not found. A new session will be created if login proceeds.");
            } else {
                this.logger.warn("Error accessing session file (permissions?):", this.cookieFilePath, err.message);
            }
            return null;
        }

        try {
            const data = await fs.readFile(this.cookieFilePath, "utf-8");
            if (!data.trim()) {
                this.logger.warn("Session file is empty. Will be overwritten on next successful login.");
                await this._deleteSavedSessionFile();
                return null;
            }
            const parsed: SavedCookieData = JSON.parse(data);

            if (parsed.trSessionToken && Array.isArray(parsed.rawCookies)) {
                this.logger.info("Session data loaded from:", this.cookieFilePath);
                return parsed;
            }

            this.logger.warn("Loaded session file is malformed. It will be overwritten.");
            await this._deleteSavedSessionFile();
            return null;
        } catch (err: any) {
            this.logger.warn("Error loading/parsing session data from file:", this.cookieFilePath, err.message);
            await this._deleteSavedSessionFile();
            return null;
        }
    }

    /**
     * Loads a saved session and validates it; on failure tries a token refresh
     * before giving up. Returns true if a usable, validated session is ready
     */
    private async _loadValidateOrRefreshSavedSession(): Promise<boolean> {
        const savedData = await this._loadSessionFromFile();
        if (!savedData?.trSessionToken) {
            return false;
        }

        this.trSessionToken = savedData.trSessionToken;
        this.trRefreshToken = savedData.trRefreshToken;
        this.rawCookies = savedData.rawCookies;

        try {
            this.logger.info("Validating saved session via WebSocket...");
            await this._setupWebSocket();

            if (this.ws?.readyState === WebSocket.OPEN &&
                (await this._performSessionValidationSubscription())) {
                this.logger.info("Saved session is valid.");
                return true;
            }

            this.logger.warn("Saved session invalid. Attempting token refresh...");
            if (await this._tryRefreshSession()) {
                this.logger.info("Session successfully refreshed.");
                return true;
            }
        } catch (error: any) {
            this.logger.warn("Error during saved-session validation/refresh:", error?.message || error);
        }

        await this._clearSessionAndConnection(true);
        return false;
    }

    /**
     * Exchanges the refresh token for a fresh session, then validates it.
     * Fails gracefully (returns false) so the caller falls back to full login.
     */
    private async _tryRefreshSession(): Promise<boolean> {
        if (!this.trRefreshToken) {
            return false;
        }
        try {
            const response = await this._request(
                TradeRepublicApi.REFRESH_ENDPOINT,
                null,
                "GET",
                true // send auth cookies, including tr_refresh
            );
            if (!response.ok) {
                this.logger.warn(`Session refresh failed with status ${response.status}.`);
                return false;
            }

            const newCookies = this._extractRawCookies(response);
            if (newCookies.length === 0) {
                this.logger.warn("Session refresh returned no cookies.");
                return false;
            }
            this.rawCookies = newCookies;

            const session = this._extractCookieValue("tr_session", false);
            if (!session) {
                this.logger.warn("Refresh response did not contain a new tr_session cookie.");
                return false;
            }
            this.trSessionToken = session;
            const refresh = this._extractCookieValue("tr_refresh", false);
            if (refresh) this.trRefreshToken = refresh;

            await this._setupWebSocket();
            if (this.ws?.readyState === WebSocket.OPEN &&
                (await this._performSessionValidationSubscription())) {
                await this._saveSessionToFile();
                return true;
            }
            return false;
        } catch (err) {
            this.logger.warn("Session refresh attempt errored:", (err as Error).message);
            return false;
        }
    }

    /**
     * Performs a lightweight subscription to check if the current session token is valid
     */
    private _performSessionValidationSubscription(): Promise<boolean> {
        const validationMessage = createMessage("availableCash");

        return new Promise<boolean>((resolve) => {
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
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
                    if (Array.isArray(data)) {
                        this.logger.info("Session validation successful.");
                        cleanupAndResolve(true);
                    } else {
                        this.logger.warn("Session validation did not return a valid cash response. Assuming invalid.");
                        cleanupAndResolve(false);
                    }
                });
            } catch (e) {
                this.logger.error("Error initiating session validation:", e instanceof Error ? e.message : e);
                cleanupAndResolve(false);
            }

            timeoutId = setTimeout(() => {
                this.logger.warn(`Session validation timed out after ${SESSION_VALIDATION_TIMEOUT_MS / 1000}s.`);
                cleanupAndResolve(false);
            }, SESSION_VALIDATION_TIMEOUT_MS);
        });
    }

    /**
     * Clears all local state (tokens, cookies, processId, WebSocket, timers, browser)
     * Does NOT clear the persisted cookie file
     */
    private async _clearLocalRuntimeState(): Promise<void> {
        this.logger.debug("Clearing local runtime state...");
        this.shouldReconnect = false;
        this._clearReconnectTimer();

        this.trSessionToken = undefined;
        this.trRefreshToken = undefined;
        this.rawCookies = [];
        this.processId = undefined;
        this.subscriptions = [];
        this.previousResponses.clear();
        this.nextSubscriptionId = 1;

        await this._closeWebSocket();

        if (this.browser) {
            this.logger.info("Closing Puppeteer browser...");
            await this.browser.close();
            this.browser = undefined;
            this.page = undefined;
            this.currentWafToken = undefined;
        }
    }

    /**
     * Deletes the saved session file from disk
     */
    private async _deleteSavedSessionFile(): Promise<void> {
        try {
            await fs.access(this.cookieFilePath);
            await fs.unlink(this.cookieFilePath);
            this.logger.info("Saved session file deleted:", this.cookieFilePath);
        } catch (err: any) {
            if (err.code !== "ENOENT") {
                this.logger.error("Error deleting saved session file:", this.cookieFilePath, err.message);
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
        this.logger.info("Logging out and clearing session...");
        await this._clearSessionAndConnection(true);
        this.logger.info("Local session cleared, saved session file deleted, and WebSocket closed.");
    }
}