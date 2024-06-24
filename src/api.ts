import * as readline from 'readline';
import { type Message, type MessageTypeMap } from './messages';
import { WebSocket } from 'ws';

interface InternalSubscription {
    id: number;
    topic: string;
    callback: (data: string | null) => void;
}

export class TRApi {
    private readonly host: string = "https://api.traderepublic.com";
    private readonly wss: string = "wss://api.traderepublic.com";

    private ws: WebSocket | undefined;
    private processId?: string;
    private cookies: string[] = [];
    private trSessionToken?: string;
    private trRefreshToken?: string;
    private subscriptions: InternalSubscription[] = [];
    private echoInterval: Timer | undefined;

    constructor(private readonly phoneNo: string, private readonly pin: string) { }

    async login(): Promise<void> {
        try {
            console.info("Logging in...");

            const loginData = await this.performLogin();

            if (!loginData.processId) {
                throw new Error("Login failed: no processId received");
            }

            this.processId = loginData.processId;

            const pinFromUser = await this.askQuestion("Please enter the PIN received on your phone: ");
            await this.verifyPin(pinFromUser);

            await this.setupWebSocket();

            console.log("Login successful and WebSocket setup completed");
        } catch (error) {
            console.error("Login failed:", error);
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
        this.trSessionToken = this.extractCookie("tr_session");
        this.trRefreshToken = this.extractCookie("tr_refresh");
    }

    private async setupWebSocket(): Promise<void> {
        this.ws = new WebSocket(this.wss);

        this.ws.on('error', (err) => {
            console.error("WebSocket error:", err);
        });

        this.ws.on('close', () => {
            console.info("WebSocket connection closed");
        });

        await new Promise<void>((resolve) => {
            this.ws!.on('open', () => {
                const connectionMessage = { locale: 'en' };
                this.ws!.send(`connect 31 ${JSON.stringify(connectionMessage)}`);
                resolve();
            });

            this.ws!.on('message', (data) => {
                this.handleWebSocketMessage(data.toString());
            });

            this.echoInterval = setInterval(this.echo.bind(this), 3000);
        });
    }

    private async request(urlPath: string, payload: any = null, method: string = "POST"): Promise<Response> {
        const headers: { [key: string]: string } = { 'Content-Type': 'application/json' };
        const response = await fetch(`${this.host}${urlPath}`, {
            method,
            headers,
            body: method === "GET" ? undefined : JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response;
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

    private extractCookie(name: string): string {
        const cookie = this.cookies.find(cookie => cookie.startsWith(`${name}=`));
        if (!cookie) {
            throw new Error(`Cookie not found: ${name}`);
        }
        return cookie.split(";")[0].split("=")[1];
    }

    public subscribe<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void): void {
        if (!this.ws) {
            throw new Error("WebSocket connection not established");
        }
        const id = this.subscriptions.length + 1;
        this.ws.send(`sub ${id} ${JSON.stringify({ token: this.trSessionToken, ...message })}`);
        this.subscriptions.push({ id, topic: message.type, callback });
    }

    private echo(): void {
        if (!this.ws) {
            throw new Error("WebSocket connection not established");
        }

        this.ws.send(`echo ${Date.now()}`);
    }

    private handleWebSocketMessage(res: string): void {
        const data = this.extractIdAndJson(res);

        if (!data) {
            return;
        }

        const subscription = this.subscriptions.find(sub => sub.id === Number(data.id));
        if (subscription) {
            subscription.callback(data.jsonData);
        }
    }

    private extractIdAndJson(input: string) {
        const startIndex = input.indexOf('{');
        if (startIndex !== -1) {
            const idPart = input.substring(0, startIndex).trim();
            const id = idPart.match(/\d+/)?.[0] || null;
            const jsonData = input.substring(startIndex).trim();
            return { id, jsonData };
        } else {
            return { id: null, jsonData: null };
        }
    }
}