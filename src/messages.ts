export interface Message<T extends string> {
    type: T;
}

export type MessageTypeMap = {
    customerPermissions: Message<"customerPermissions">;
    compactPortfolioByType: Message<"compactPortfolioByType">;
    portfolioStatus: Message<"portfolioStatus">;
    orders: Message<"orders"> & { terminated: boolean };
    cash: Message<"cash">;
    availableCash: Message<"availableCash">;
    neonSearch: Message<"neonSearch"> & {
        data: {
            q: string;
            page: number;
            pageSize: number;
            filter: { key: string; value: string }[];
        };
    };
    instrument: Message<"instrument"> & {
        id: string;
        jurisdiction: string;
    };
    homeInstrumentExchange: Message<"homeInstrumentExchange"> & {
        id: string;
    };
    savingsPlans: Message<"savingsPlans">;
    ticker: Message<"ticker"> & {
        id: string;
    };
    namedWatchlist: Message<"namedWatchlist"> & {
        watchlistId: string;
    };
    frontendExperiment: Message<"frontendExperiment"> & {
        operation: "assignment" | "exposure";
        experimentId: string;
        identifier: string;
    };
    userPortfolioChartModifiedDietz: Message<"userPortfolioChartModifiedDietz"> & {
        range: string;
    };
};


export function createMessage<T extends keyof MessageTypeMap>(
    type: T,
    data?: Omit<MessageTypeMap[T], 'type'>
): MessageTypeMap[T] {
    return { type, ...data } as MessageTypeMap[T];
}