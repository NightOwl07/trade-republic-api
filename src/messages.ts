export interface Message<T extends string> {
    type: T;
}

export type MessageTypeMap = {
    customerPermissions: Message<"customerPermissions">;
    compactPortfolioByType: Message<"compactPortfolioByType"> & {
        secAccNo?: string;
    };
    portfolioStatus: Message<"portfolioStatus">;
    orders: Message<"orders"> & { terminated: boolean };
    cash: Message<"cash">;
    availableCash: Message<"availableCash">;
    availableCashForPayout: Message<"availableCashForPayout">;
    neonSearch: Message<"neonSearch"> & {
        data: {
            q: string;
            page: number;
            pageSize: number;
            filter: { key: string; value: string }[];
        };
    };
    neonSearchSuggestedTags: Message<"neonSearchSuggestedTags"> & {
        data: {
            q: string;
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
    savingsPlanParameters: Message<"savingsPlanParameters"> & {
        instrumentId: string;
    };
    timelineSavingsPlanOverview: Message<"timelineSavingsPlanOverview"> & {
        savingsPlanId: string;
    };
    createSavingsPlan: Message<"createSavingsPlan"> & {
        parameters: {
            instrumentId: string;
            amount: number;
            startDate: {
                type: "dayOfMonth" | "twoPerMonth" | "monthly" | "quarterly";
                value: number;
                nextExecutionDate: string;
                availablePaymentMethods: string[]; // sepadirectdebit, creditcard
            };
            interval: "weekly";
        };
        warningsShown: string[];
    };
    changeSavingsPlan: Message<"changeSavingsPlan"> & {
        id: string;
        parameters: {
            instrumentId: string;
            amount: number;
            startDate: {
                type: "dayOfMonth" | "twoPerMonth" | "monthly" | "quarterly";
                value: number;
                nextExecutionDate: string;
                availablePaymentMethods: string[];
            };
            interval: string;
        };
        warningsShown: string[];
    };
    cancelSavingsPlan: Message<"cancelSavingsPlan"> & {
        id: string;
    };
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
        range: "1d" | "5d" | "1m" | "1y" | "max";
    };
    fincrimeBanner: Message<"fincrimeBanner">;
    tradingPerkConditionStatus: Message<"tradingPerkConditionStatus">;
    watchlists: Message<"watchlists">;
    timelineActionsV2: Message<"timelineActionsV2">;
    timelineTransactions: Message<"timelineTransactions">;
    timelineActivityLog: Message<"timelineActivityLog">;
    timelineDetailV2: Message<"timelineDetailV2"> & {
        id: string;
    };
    collection: Message<"collection"> & {
        view: string;
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
        resolution?: string;
    };
    priceForOrder: Message<"priceForOrder"> & {
        parameters: {
            exchangeId: string;
            instrumentId: string;
            type: "buy" | "sell";
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
            mode: "market" | "limit" | "stopMarket";
            type: "buy" | "sell";
            size: number;
            expiry: {
                type: "gfd"
                value?: string; // date for limit and stopMarket e.g. 2026-10-29
            };
            acceptedTerms?: [
                {
                    groupId: string;
                    groupName: string;
                }
            ];
            sellFractions: boolean;
            lastClientPrice: number;
        };
        warningsShown: string[];
        clientProcessId: string;
        secAccNo: string;
    };
    derivatives: Message<"derivatives"> & {
        jurisdiction: string;
        lang: string;
        underlying: string;
        productCategory: "knockOutProduct" | "vanillaWarrant" | "factorCertificate";
        leverage: number;
        sortBy: "leverage" | "factor" | "strike";
        sortDirection: string;
        optionType: "call" | "put" | "long" | "short";
        pageSize: number;
        after: string;
    };
    accountPairs: Message<"accountPairs">;
    neonSearchAggregations: Message<"neonSearchAggregations"> & {
        data: {
            q: string;
            filter: { key: string; value: string }[];
        };
    };
    etfDetails: Message<"etfDetails"> & {
        id: string;
    };
    removeFromWatchlist: Message<"removeFromWatchlist"> & {
        instrumentId: string;
        watchlistId: "favorites";
    };
    addToWatchlist: Message<"addToWatchlist"> & {
        instrumentId: string;
        watchlistId: "favorites";
    };
    etfComposition: Message<"etfComposition"> & {
        id: string;
    };
    cancelOrder: Message<"cancelOrder"> & {
        id: string;
    };
    stockDetailDividends: Message<"stockDetailDividends"> & {
        id: string;
    };
    bondValuation: Message<"bondValuation"> & {
        instrumentId: string;
    };
    neonSearchTags: Message<"neonSearchTags">;
};

export function createMessage<T extends keyof MessageTypeMap>(
    type: T,
    data?: Omit<MessageTypeMap[T], 'type'>
): MessageTypeMap[T] {
    return { type, ...data } as MessageTypeMap[T];
}