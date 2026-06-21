# trade-republic-api

## Overview

TradeRepublicApi is a TypeScript library for interacting with the Trade Republic API. It supports logging in, maintaining a WebSocket connection, subscribing to various message types, and managing sessions.

This project was created using Bun v1.1.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

> **Note:** This project is still under active development. Features may change, and there may be bugs or incomplete functionality. Please use with caution.

## Features

-   **Login**: Authenticate using phone number and PIN, including app confirmation.
-   **AWS WAF Bypass**: Automatically fetches a WAF token via Puppeteer.
-   **Session Persistence**: Sessions are saved locally (`~/.tr_api_cookies.json`) and refreshed via refresh token when needed.
-   **WebSocket Connection**: Setup, echo keepalive, and automatic reconnect with exponential backoff.
-   **Subscriptions**: Typed subscriptions to many topics via `createMessage` + `subscribe`/`subscribeOnce`.
-   **Events**: `open`, `close`, `reconnecting`, `reconnect_failed`, `error`.
-   **Pluggable Logging**: Inject your own `Logger` or `silentLogger`; defaults to `console`.
-   **Logout**: Clears local session data and the persisted session file.

## Requirements

-   **Runtime**: [Bun](https://bun.sh) v1.1.13 or newer (alternatively Node.js 18+ with `npm`/`yarn`).
-   **Trade Republic Account**: An active phone number and PIN.
-   **Trade Republic App**: The phone running the app must be available during the first login to confirm the sign-in.
-   **Puppeteer**: Used for the WAF token bypass. The browser is launched headless.

## Installation

```bash
bun add NightOwl07/trade-republic-api
# or
npm install NightOwl07/trade-republic-api
# or
yarn add NightOwl07/trade-republic-api
```

## Usage

### Constructor

```typescript
new TradeRepublicApi(
    phoneNo,             // e.g. "+4912345678910"
    pin,                 // Trade Republic PIN
    cookieStoragePath?,  // optional: custom path for the session file (default: ~/.tr_api_cookies.json)
    logger?              // optional: custom logger (default: console)
)
```

### Example: Portfolio & Ticker

Subscription callbacks receive the already-parsed, typed response.

```typescript
import { TradeRepublicApi, createMessage } from "trapi";

const api = new TradeRepublicApi("+4912345678910", "1234");
await api.login();

// Fetch portfolio and print company names
const portfolioMessage = createMessage("compactPortfolioByType");
api.subscribeOnce(portfolioMessage, (portfolio) => {
    if (!portfolio) return;

    const categories = portfolio.categories.filter(c => c.categoryType !== "cryptos");
    const companies: string[] = Array.from(new Set(
        categories.flatMap(category => category.positions.map(pos => pos.name))
    ));

    console.log(companies);
});

// Subscribe to the Tesla ticker (format: ISIN.Exchange, e.g. LSX | BHS | TUB | SGL | BVT)
api.subscribe(createMessage("ticker", { id: "US88160R1014.LSX" }), (data) => {
    if (!data) return;
    console.log(data);
});
```

### Example: Search

```typescript
const searchMessage = createMessage("neonSearch", {
    data: {
        q: "amd",
        page: 1,
        pageSize: 3,
        filter: [
            { key: "type", value: "stock" },
            { key: "jurisdiction", value: "DE" }
        ]
    }
});

api.subscribeOnce(searchMessage, (results) => {
    console.log("Search results:", results?.results);
});
```

### Login Notes

- If a valid saved session exists, it is reused (no PIN/app confirmation required).
- If the session is invalid, the library attempts a refresh via the refresh token.
- Only if both fail does the full login flow (including app confirmation) run.

### Events

```typescript
api.on("open",             () => console.log("WS connected"));
api.on("close",            (code, reason) => console.log("WS closed", code, reason));
api.on("reconnecting",     (attempt, delayMs) => console.log(`Reconnect ${attempt} in ${delayMs}ms`));
api.on("reconnect_failed", () => console.log("Reconnect permanently failed"));
api.on("error",            (err) => console.error("Error:", err));
```

### Logging

By default, the library logs to `console`. Pass a custom `Logger` (4th constructor argument) to route logs elsewhere or silence them entirely:

```typescript
import { TradeRepublicApi, silentLogger } from "trapi";

// Silence all library logging:
const api = new TradeRepublicApi("+49...", "1234", undefined, silentLogger);

// Or inject your own sink (e.g. pino, winston):
const api2 = new TradeRepublicApi("+49...", "1234", undefined, {
    debug: () => {},                       // drop debug
    info:  (...a) => myLog.info(a),
    warn:  (...a) => myLog.warn(a),
    error: (...a) => myLog.error(a),
});
```

### Logout

```typescript
// Clear local session and remove the saved session file
await api.logout();
```

## Development

```bash
bun install        # install dependencies
bun run build      # build types + output to ./types (via build.mjs)
bun run typecheck  # tsc --noEmit
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

---

**Disclaimer:** This project is not officially affiliated with Trade Republic. Use at your own risk.
