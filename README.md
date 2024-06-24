# trade-republic-api

## Overview

TRApi is a TypeScript library designed to interact with the Trade Republic API. It facilitates logging in, maintaining a WebSocket connection, and subscribing to various message types. This project is currently under development.
This project was created using bun v1.1.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Features

- **Login**: Authenticate using phone number and PIN.
- **WebSocket Connection**: Establish and maintain a connection with the Trade Republic WebSocket API.
- **Subscriptions**: Subscribe to various message types and handle incoming data.

## Installation

```bash
npm i https://github.com/nightowl07/trade-republic-api
```

## Usage

Here is a basic example of how to use the api to get your portfolio and print all companies:

```typescript
const api = new TRApi("phoneNumber", "pin");
await api.login();

var portfolioMessage = createMessage("compactPortfolioByType");
api.subscribe(portfolioMessage, (data) => {
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

api.subscribe(searchMessage, (data) => {
    console.log("serach data", data);
});
```

## Methods

### `login()`

Logs in to the Trade Republic API using the provided phone number and PIN.

### `subscribe<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void)`

Subscribes to a specific message type. The callback function is called whenever a message of the subscribed type is received.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.
---

**Note:** This project is still in development. Features and functionalities may change, and there may be bugs or incomplete features. Please use with caution.