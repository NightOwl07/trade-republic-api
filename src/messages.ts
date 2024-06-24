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
    fincrimeBanner: Message<"fincrimeBanner">;
    tradingPerkConditionStatus: Message<"tradingPerkConditionStatus">;
    watchlists: Message<"watchlists">;
    timelineActions: Message<"timelineActions">;
    collection: Message<"collection"> & {
        view: string;
    };
    neonSearchSuggestedTags: Message<"neonSearchSuggestedTags"> & {
        data: {
            q: string;
        };
    };
    availableSize: Message<"availableSize"> & {
        parameters: {
            exchangeId: string;
            instrumentId: string;
        };
    };
    aggregateHistoryLight: Message<"aggregateHistoryLight"> & {
        range: string;
        id: string;
    };
    priceForOrder: Message<"priceForOrder"> & {
        parameters: {
            exchangeId: string;
            instrumentId: string;
            type: string;
        };
    };
    stockDetails: Message<"stockDetails"> & {
        id: string;
        jurisdiction: string;
    };
    performance: Message<"performance"> & {
        id: string;
    };
    yieldToMaturity: Message<"yieldToMaturity"> & {
        id: string;
    };
    neonNews: Message<"neonNews"> & {
        isin: string;
    };
    instrumentSuitability: Message<"instrumentSuitability"> & {
        instrumentId: string;
    };
    simpleCreateOrder: Message<"simpleCreateOrder"> & {
        parameters: {
            instrumentId: string;
            exchangeId: string;
            mode: string;
            type: string;
            size: number;
            expiry: { type: string };
            sellFractions: boolean;
            lastClientPrice: number;
        };
        warningsShown: string[];
        clientProcessId: string;
    };
};

export function createMessage<T extends keyof MessageTypeMap>(
    type: T,
    data?: Omit<MessageTypeMap[T], 'type'>
): MessageTypeMap[T] {
    return { type, ...data } as MessageTypeMap[T];
}