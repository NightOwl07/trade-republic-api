import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { type Message, type MessageTypeMap } from './messages';
import { WebSocket } from 'ws';

interface InternalSubscription {
    id: number;
    topic: string;
    callback: (data: string | null) => void;
    isOneTime: boolean;
}

interface SavedCookieData {
    trSessionToken: string;
    trRefreshToken?: string;
    rawCookies: string[];
}

export class TradeRepublicApi {
    private static readonly HOST: string = "https://api.traderepublic.com";
    private static readonly WS_HOST: string = "wss://api.traderepublic.com";
    private static readonly WS_CONNECT_VERSION = "31";

    private ws: WebSocket | undefined;
    private processId?: string;
    private cookies: string[] = [];
    private trSessionToken?: string;
    private trRefreshToken?: string;
    private subscriptions: InternalSubscription[] = [];
    private echoInterval: Timer | undefined;
    private subCount: number = 1;
    private readonly cookieFilePath: string;


    constructor(
        private readonly phoneNo: string,
        private readonly pin: string,
        cookieStoragePath?: string
    ) {
        if (cookieStoragePath) {
            this.cookieFilePath = path.resolve(cookieStoragePath);
        } else {
            this.cookieFilePath = path.join(os.homedir(), '.tr_api_cookies.json');
        }
    }

    async login(): Promise<void> {
        try {
            console.info("Attempting to log in...");

            if (await this.loadAndValidateSavedSession()) {
                console.log("Successfully logged in using saved session. WebSocket setup completed.");
                return;
            }

            console.info("Saved session invalid or not found. Performing full login...");
            const loginData = await this.performLogin();

            if (!loginData.processId) {
                throw new Error("Login failed: no processId received");
            }
            this.processId = loginData.processId;

            const pinFromUser = await this.askQuestion("Please enter the PIN received on your phone: ");
            await this.verifyPin(pinFromUser);
            await this.saveCookiesToFile();

            await this.setupWebSocket();

            console.log("Login successful and WebSocket setup completed");
        } catch (error) {
            console.error("Login failed:", error);
            if (this.ws) {
                this.ws.close();
                this.ws = undefined;
            }
            if (this.echoInterval) {
                clearInterval(this.echoInterval);
                this.echoInterval = undefined;
            }
        }
    }

    private async performLogin(): Promise<any> {
        const loginResponse = await this.request("/api/v1/auth/web/login", {
            phoneNumber: this.phoneNo,
            pin: this.pin
        });
        return await loginResponse.json();
    }

    private async verifyPin(pin: string): Promise<void> {
        const verifyResponse = await this.request(`/api/v1/auth/web/login/${this.processId}/${pin}`);
        if (verifyResponse.status !== 200) {
            throw new Error(`Verification failed with status: ${verifyResponse.status}`);
        }
        this.cookies = verifyResponse.headers.getSetCookie();
        const sessionToken = this.extractCookie("tr_session", true);
        if (!sessionToken) {
            throw new Error("Critical: tr_session token not extracted after PIN verification.");
        }
        this.trSessionToken = sessionToken;
        this.trRefreshToken = this.extractCookie("tr_refresh", false);
    }

    private async setupWebSocket(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.info("WebSocket already connected.");
            return;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.terminate();
        }

        this.ws = new WebSocket(TradeRepublicApi.WS_HOST);

        this.ws.on('error', (err) => {
            console.error("WebSocket error:", err);
        });

        this.ws.on('close', () => {
            console.info("WebSocket connection closed");
            if (this.echoInterval) {
                clearInterval(this.echoInterval);
                this.echoInterval = undefined;
            }
        });

        return new Promise<void>((resolve, reject) => {
            this.ws!.on('open', () => {
                console.info("WebSocket connection opened.");
                const connectionMessage = { locale: 'en' };
                this.ws!.send(`connect ${TradeRepublicApi.WS_CONNECT_VERSION} ${JSON.stringify(connectionMessage)}`);

                if (this.echoInterval) clearInterval(this.echoInterval);
                this.echoInterval = setInterval(this.echo.bind(this), 30000);
                resolve();
            });

            this.ws!.on('message', (data) => {
                this.handleWebSocketMessage(data.toString());
            });

            const timeout = setTimeout(() => {
                reject(new Error("WebSocket connection timed out"));
                if (this.ws) {
                    this.ws.terminate();
                }
            }, 10000);

            this.ws!.on('open', () => clearTimeout(timeout));
            this.ws!.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    private async request(
        urlPath: string,
        payload: any = null,
        method: string = "POST",
        sendAuthCookies: boolean = false
    ): Promise<Response> {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (sendAuthCookies && this.cookies.length > 0) {
            headers['Cookie'] = this.cookies.map(c => c.split(';')[0]).join('; ');
        }

        const options: RequestInit = {
            method,
            headers,
            body: (method === "GET" || method === "DELETE" || !payload) ? undefined : JSON.stringify(payload)
        };

        return await fetch(`${TradeRepublicApi.HOST}${urlPath}`, options);
    }

    private async askQuestion(question: string): Promise<string> {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise<string>((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    private extractCookie(name: string, required: boolean = true): string | undefined {
        const cookie = this.cookies.find(c => c.startsWith(`${name}=`));
        if (!cookie) {
            if (required) {
                throw new Error(`Required cookie not found: ${name}`);
            }
            return undefined;
        }
        return cookie.split(";")[0].split("=")[1];
    }

    public subscribe<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void): void {
        this.subscribeInternal(message, callback, false);
    }

    public subscribeOnce<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void): void {
        this.subscribeInternal(message, callback, true);
    }

    private subscribeInternal<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void, isOneTime: boolean): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("WebSocket connection not established or not open. Cannot subscribe.");
            return;
        }
        if (!this.trSessionToken) {
            console.error("Session token is not available. Cannot subscribe.");
            return;
        }

        this.ws.send(`sub ${this.subCount} ${JSON.stringify({ token: this.trSessionToken, ...message })}`);
        this.subscriptions.push({ id: this.subCount, topic: message.type, callback, isOneTime });

        this.subCount++;
    }

    private echo(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        try {
            this.ws.send(`echo ${Date.now()}`);
        } catch (error) {
            console.error("Failed to send echo:", error);
        }
    }

    private handleWebSocketMessage(res: string): void {
        const data = this.extractIdAndJson(res);

        if (!data) {
            return;
        }

        const subscriptionId = data.id ? Number(data.id) : null;
        if (subscriptionId === null) {
            return;
        }

        const index = this.subscriptions.findIndex(sub => {
            if (sub.id === subscriptionId) {
                sub.callback(data.jsonData);
                return sub.isOneTime;
            }
            return false;
        });

        if (index !== -1) {
            this.subscriptions.splice(index, 1);
        }
    }

    private extractIdAndJson(input: string) {
        const startIndex = input.indexOf('{');
        if (startIndex !== -1) {
            const idPart = input.substring(0, startIndex).trim();
            const idMatch = idPart.match(/\d+/);
            const id = idMatch ? idMatch[0] : null;
            const jsonData = input.substring(startIndex).trim();
            return { id, jsonData };
        } else {
            return { id: null, jsonData: null };
        }
    }

    private async saveCookiesToFile(): Promise<void> {
        if (this.trSessionToken && this.cookies.length > 0) {
            const cookieData: SavedCookieData = {
                trSessionToken: this.trSessionToken,
                trRefreshToken: this.trRefreshToken,
                rawCookies: this.cookies
            };
            try {
                await fs.writeFile(this.cookieFilePath, JSON.stringify(cookieData, null, 2), 'utf-8');
                console.info("Session cookies saved to:", this.cookieFilePath);
            } catch (err) {
                console.error("Error saving cookies to file:", err);
            }
        } else {
            console.warn("No session token or raw cookies to save.");
        }
    }

    private async loadCookiesFromFile(): Promise<SavedCookieData | null> {
        try {
            await fs.access(this.cookieFilePath);

            const data = await fs.readFile(this.cookieFilePath, 'utf-8');
            const parsed: SavedCookieData = JSON.parse(data);

            if (parsed.trSessionToken && Array.isArray(parsed.rawCookies)) {
                return parsed;
            }

            console.warn("Loaded cookie file is malformed.");

            await this.clearSavedCookiesAndState();

            return null;
        } catch (err: any) {
            if (err.code === 'ENOENT') {
            } else {
                console.warn("Error loading cookies from file:", err);
            }

            return null;
        }
    }

    private async loadAndValidateSavedSession(): Promise<boolean> {
        const savedData = await this.loadCookiesFromFile();
        if (!savedData || !savedData.trSessionToken) {
            return false;
        }

        this.trSessionToken = savedData.trSessionToken;
        this.trRefreshToken = savedData.trRefreshToken;
        this.cookies = savedData.rawCookies;

        console.info("Loaded session from file. Validating session via API request...");

        try {
            const validationResponse = await this.request("/api/v1/auth/web/session", null, "GET", true);

            if (validationResponse.ok) {
                console.info("Saved session is valid. Proceeding to set up WebSocket.");
                await this.setupWebSocket();
                return true;
            } else {
                console.warn(`Saved session validation failed (HTTP ${validationResponse.status}). Invalidating saved session.`);
                await this.clearSavedCookiesAndState();
                return false;
            }
        } catch (error) {
            console.warn("Error during saved session validation or WebSocket setup:", error);
            await this.clearSavedCookiesAndState();
            return false;
        }
    }

    private clearLocalState(): void {
        this.trSessionToken = undefined;
        this.trRefreshToken = undefined;
        this.cookies = [];
        this.processId = undefined;
        this.subscriptions = [];
        this.subCount = 1;

        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = undefined;
        }
        if (this.echoInterval) {
            clearInterval(this.echoInterval);
            this.echoInterval = undefined;
        }
    }

    private async clearSavedCookiesAndState(): Promise<void> {
        this.clearLocalState();
        try {
            await fs.access(this.cookieFilePath);
            await fs.unlink(this.cookieFilePath);
            console.info("Invalid/old saved cookie file deleted:", this.cookieFilePath);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
            } else {
                console.error("Error deleting saved cookie file:", err);
            }
        }
    }

    public async logout(): Promise<void> {
        console.info("Logging out and clearing session...");
        await this.clearSavedCookiesAndState();
        console.info("Session cleared.");
    }
}