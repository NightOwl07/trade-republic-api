# trade-republic-api
## Overview

TradeRepublicApi is a TypeScript library designed to interact with the Trade Republic API. It facilitates logging in, maintaining a WebSocket connection, subscribing to various message types, and managing session persistence. This project is currently under active development.

This project was created using Bun v1.1.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Features

-   **Login**: Authenticate using phone number and PIN.
-   **Session Persistence**: Automatically saves and reuses login sessions to avoid frequent PIN entry. Session data is stored locally.
-   **WebSocket Connection**: Establish and maintain a connection with the Trade Republic WebSocket API.
-   **Subscriptions**: Subscribe to various message types (e.g., ticker data, portfolio updates) and handle incoming data.
-   **Message Helper**: Includes a `createMessage` utility to easily construct messages for the API.
-   **Logout**: Clear local session data.

## Installation
```bash
bun add NightOwl07/trade-republic-api
# or npm install NightOwl07/trade-republic-api
# or yarn add NightOwl07/trade-republic-api
```

## Usage

Here is a basic example of how to use the api to get your portfolio and print all companies:

```typescript
const api = new TradeRepublicApi("phoneNumber", "pin");
await api.login();

var portfolioMessage = createMessage("compactPortfolioByType");
api.subscribeOnce(portfolioMessage, (data) => {
    if (!data) {
        return;
    }

    var portfolio: Portfolio = JSON.parse(data);

    var categories = portfolio.categories.filter(c => c.categoryType != "cryptos");

    if (!categories) {
        return;
    }

    let companies: string[] = Array.from(new Set(categories.flatMap(category =>
        category.positions.map(pos =>
            pos.derivativeInfo ? pos.derivativeInfo.underlying.shortName : pos.name
        )
    )));

    console.log(companies);
});

// sub to tesla ticker on lsx (id = ISIN.Exchange [LSX | BHS | TUB | SGL | BVT ..])
api.subscribe(createMessage("ticker", { id: "US88160R1014.LSX" }), (data) => {
    if (!data) {
        return;
    }

    console.log(data);
});

// search
var searchMessage = createMessage("neonSearch", {
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

api.subscribeOnce(searchMessage, (data) => {
    console.log("serach data", data);
});

// clear local session
// await api.logout();
```


## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.
---

**Note:** This project is still in development. Features and functionalities may change, and there may be bugs or incomplete features. Please use with caution.