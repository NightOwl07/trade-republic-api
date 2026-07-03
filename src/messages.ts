import type { Portfolio, Position } from './portfolio';

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
        leverage?: number;
        sortBy: "leverage" | "factor" | "strike";
        sortDirection: string;
        optionType: "call" | "put" | "long" | "short";
        pageSize: number;
        after?: string;
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
    compactPortfolioByTypeV2: Message<"compactPortfolioByTypeV2"> & {
        secAccNo: string;
    };
    cryptoPortfolioStatus: Message<"cryptoPortfolioStatus"> & {
        secAccNo: string;
    };
    fixedIncomePortfolioStatus: Message<"fixedIncomePortfolioStatus"> & {
        secAccNo: string;
    };
    privateMarketsPortfolioStatus: Message<"privateMarketsPortfolioStatus"> & {
        secAccNo: string;
    };
    privateMarketsPositions: Message<"privateMarketsPositions"> & {
        secAccNo: string;
    };
    priceAlarms: Message<"priceAlarms">;
    priceForOrderV2: Message<"priceForOrderV2"> & {
        isin: string;
        exchangeId: string;
        side: "buy" | "sell";
        unit: string;
    };
    tape: Message<"tape"> & {
        isin: string;
        exchangeId: string;
        unit: string;
    };
    tickerV2: Message<"tickerV2"> & {
        isin: string;
        exchangeId: string;
        unit: string;
    };
    tradingStatus: Message<"tradingStatus"> & {
        isin: string;
        exchangeId: string;
        currencyCode: string;
    };
    tradeAggregateHistory: Message<"tradeAggregateHistory"> & {
        isin: string;
        exchangeId: string;
        resolution: number; // ms
        from: number;   // epoch ms
        until: number;  // epoch ms
    };
    bondValuationV2: Message<"bondValuationV2"> & {
        instrumentId: string;
        secAccNo: string;
    };
    stockDetailKpis: Message<"stockDetailKpis"> & {
        id: string;
    };
};

export interface Money {
    value: string | number;
    currency: string;
}

export interface Tag {
    id: string;
    name: string;
    type: string;
}

export interface PriceQuote {
    time: number;
    price: string;
    size: number;
}

export interface CashBalance {
    accountNumber: string;
    currencyId: string;
    amount: number;
}

export interface SearchResult {
    derivativeProductCategories: string[];
    hasCfd: boolean;
    imageId: string;
    instrumentCategory: string;
    instrumentType: string;
    isin: string;
    name: string;
    tags: Tag[];
    type: string;
}

export interface TickerResponse {
    bid: PriceQuote | null;
    ask: PriceQuote | null;
    last: PriceQuote | null;
    pre: PriceQuote | null;
    open: PriceQuote | null;
    qualityId: string;
    leverage: number | null;
    delta: number | null;
}

export interface ExchangeInfo {
    exchangeId: string;
    exchange: { id: string; name: string; timeZoneId: string };
    currency: { id: string; name: string };
    open: boolean;
    orderModes: string[];
    orderExpiries: string[];
    priceSteps: unknown[];
    openTimeOffsetMillis: number;
    closeTimeOffsetMillis: number;
    maintenanceWindow: string | null;
}

export interface InstrumentFractionalTrading {
    minOrderSize: string | null;
    maxOrderSize: string | null;
    stepSize: string | null;
    orderAmountLimitCurrency: string | null;
    minOrderAmount: string | null;
    maxOrderAmount: string | null;
}

export interface InstrumentExchange {
    slug: string;
    active: boolean;
    nameAtExchange: string;
    symbolAtExchange: string;
    band: number | null;
    firstSeen: number;
    lastSeen: number;
    firstTradingDay: string | null;
    lastTradingDay: string | null;
    tradingTimes: unknown;
    fractionalTrading: InstrumentFractionalTrading | null;
    dmaTrading: InstrumentFractionalTrading | null;
    settlementRoute: string;
    weight: number | null;
    currencyId?: string;
    id?: string;
}

export interface InstrumentJurisdiction {
    active: boolean;
    kidLink: string | null;
    kidRequired: boolean;
    savable: boolean;
    fractionalTradingAllowed: boolean;
    proprietaryTradable: boolean;
    usesWeightsForExchanges: boolean;
    weights: unknown;
}

export interface Instrument {
    active: boolean;
    exchangeIds: string[];
    exchanges: InstrumentExchange[];
    primaryExchange?: InstrumentExchange;
    jurisdictions: Record<string, InstrumentJurisdiction>;
    dividends: unknown[];
    splits: unknown[];
    cfi: string;
    name: string;
    typeId: string;
    legalTypeId: string | null;
    wkn: string;
    legacyTypeChar: string;
    isin: string;
    priceFactor: number;
    shortName: string;
    nextGenName: string;
    alarmsName: string;
    homeSymbol: string;
    intlSymbol: string;
    homeNsin: string;
    tags: Tag[];
    derivativeProductCount: Record<string, unknown>;
    derivativeProductCategories: string[];
    company: { name: string; description: string | null; ipoDate: number; countryOfOrigin: string } | null;
    marketCap: { value: string; currencyId: string } | null;
    lastDividend: unknown;
    shareType: string;
    custodyType: string;
    custodyCountry: string;
    tradingVenue: string;
    kidRequired: boolean;
    kidLink: string | null;
    tradable: boolean;
    fundInfo: unknown;
    privateFundInfo: unknown;
    mutualFundInfo: unknown;
    derivativeInfo: unknown;
    bondInfo: unknown;
    targetMarket: { investorExperience: string; investorType: string };
    savable: boolean;
    fractionalTradingAllowed: boolean;
    proprietaryTradable: boolean;
    issuer: unknown;
    issuerDisplayName: unknown;
    issuerImageId: unknown;
    notionalCurrency: unknown;
    additionalBuyWarning: unknown;
    warningMessage: unknown;
    description: unknown;
    noTradeVolume: boolean;
    additionalBuyWarnings: unknown;
    warningMessages: unknown;
    descriptions: unknown;
    usesWeightsForExchanges: boolean;
    imageId: string;
    exchangeStatuses: Record<string, string>;
    cfdInfo: unknown;
    sanctioned: boolean;
    eligibleForProducts: unknown[];
    taxProviderInfo: Record<string, unknown>;
    originCountry: string;
    instrumentCategory: string;
    altName: unknown;
    scope: unknown;
    corporateActionInfo: unknown;
    deviatingTaxationCountry: unknown;
    frRegisteredShareType: unknown;
    custodyCountryCode: string;
    officialNameA: string;
    officialNameB: string;
    financialTransactionTax: unknown;
    listings: Array<InstrumentExchange & { id: string; currencyId: string }>;
    isIPO: boolean;
    isSynthetic: boolean;
}

export interface SavingsPlanStartDate {
    type: "dayOfMonth" | "twoPerMonth" | "monthly" | "quarterly";
    value: number;
    nextExecutionDate: string;
    availablePaymentMethods: string[];
    isDirectDebitWindowInitiated: boolean;
    nextDirectDebitExecutionDate: string;
}

export interface SavingsPlanParameters {
    intervals: Array<{
        interval: string;
        startDates: SavingsPlanStartDate[];
    }>;
    amount: { min: number; max: number; unit: number; currency: string };
    exchangeInfo: { id: string; name: string };
}

export interface CollectionImageEntry {
    width: number;
    height: number;
    scale: number;
    url: string;
    url_next_gen: string;
    url_next_gen_icon?: string;
}

export interface CollectionCover {
    small: CollectionImageEntry[];
    medium: CollectionImageEntry[];
    large: CollectionImageEntry[];
}

export interface WatchlistInstrument {
    instrument_id: string;
    created_at?: unknown;
    holding_percent?: number;
}

export interface Watchlist {
    id: string;
    cover?: CollectionCover;
    size?: number;
    title?: string;
    description?: string;
    description_short?: string;
    created_at?: string;
    updated_at?: string;
    instruments?: WatchlistInstrument[];
    following?: boolean;
    following_allowed?: boolean;
    editing_allowed?: boolean;
    investable_isin?: string;
    sharing_allowed?: boolean;
    jurisdiction_mismatch?: boolean;
    share_text?: string;
    watchlists?: Watchlist[];
}

export interface AggregateHistoryEntry {
    time: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: number;
    adjValue: string;
}

export interface AggregateHistoryLightResponse {
    expectedClosingTime: number;
    aggregates: AggregateHistoryEntry[];
    lastAggregateEndTime: number;
    resolution: string;
}

export interface PriceForOrderResponse {
    currencyId: string;
    price: number;
    priceFactor: number;
    priceAsk: number;
    priceBid: number;
    time: number;
}

export interface StockDetails {
    isin: string;
    company: {
        name: string;
        description: string;
        yearFounded: number | null;
        tickerSymbol: string | null;
        peRatioSnapshot: number | null;
        pbRatioSnapshot: number | null;
        dividendYieldSnapshot: number | null;
        earningsCall: unknown;
        marketCapSnapshot: number | null;
        marketCapCurrency: string | null;
        dailyCloseYearSD: number | null;
        beta: number | null;
        countryCode: string | null;
        ceoName: string | null;
        cfoName: string | null;
        cooName: string | null;
        employeeCount: number | null;
        eps: number | null;
        epsCurrency: string | null;
    };
    similarStocks: Array<{ isin: string; name: string; tags: Tag[] }>;
    aggregatedDividends?: unknown[];
    analystRating?: unknown;
    dividendFrequency?: string | null;
    dividends?: unknown[];
    events?: unknown[];
    expectedDividend?: unknown;
    hasKpis?: boolean;
    pastEvents?: unknown[];
    totalDivendendCount?: number;
}

export interface PerformanceResponse {
    high_1d: string;
    low_1d: string;
    price_5d: string;
    price_1m: string;
    price_3m: string;
    price_6m: string;
    price_1y: string;
    price_3y: string;
    price_5y: string;
    high_52w: string;
    low_52w: string;
}

export interface BondValuation {
    isin: string;
    total: Money;
    maturityDate: string;
    yield: string;
    sinceBuyPerformance: { absolute: Money; relative: string };
    dailyPerformance: { absolute: Money; relative: string };
    invested: Money;
    netSize: string;
    netAccruedInterest: Money;
    accumulatedAccruedInterest: Money;
    paidAccruedInterest: Money;
    amortization: Money;
    perTradeAmortizationSum: Money;
    outstandingCoupons: number;
}

export interface NeonNewsItem {
    id: string;
    createdAt: number;
    provider: string;
    headline: string;
    summary: string;
    url: string;
}

export interface TimelineEntry {
    id: string;
    timestamp: string;
    title: string;
    icon: string;
    avatar?: { asset: string; badge: string | null };
    badge?: string | null;
    subtitle?: string;
    amount?: { currency: string; value: number; fractionDigits: number };
    subAmount?: unknown;
    status?: string;
    action: { type: string; payload: string | { link: string } };
    cashAccountNumber?: string;
    trailing?: unknown;
    eventType: string;
    hidden: boolean;
    deleted: boolean;
}

export interface AccountPair {
    securitiesAccountNumber: string;
    cashAccountNumber: string;
    productType: string;
    currency: string;
    accountAccessType: string;
}

/** @deprecated Use `Position` from the portfolio module (the canonical type). */
export type PortfolioPosition = Position;

export interface PortfolioStatusResponse {
    status: string;
    hasInvested: boolean;
    firstCashReceived: boolean;
    firstPortfolioUsage: boolean;
    bitgoTermsRequired: boolean;
    proprietaryTradingTermsRequired: boolean;
    reKycRequired: unknown[];
    sourceOfFundsRequired: boolean;
    tradingBlockedOnIdentification: string | null;
    bondsTermsRequired: boolean;
    privateFundTermsRequired: boolean;
    dmaTermsRequired: boolean;
}

export interface CompactPortfolioPosition {
    isin: string;
    averageBuyIn: { value: number; currency: string };
    netSize: number;
    virtualSize: number;
    status: string;
    instrumentType: string;
    name: string;
    derivativeInfo: unknown;
    bondInfo: unknown;
    imageId: string;
    isIPO: boolean;
}

export interface CompactPortfolioCategory {
    categoryType: string;
    positions: CompactPortfolioPosition[];
}

export interface CompactPortfolioByTypeV2Response {
    categories: CompactPortfolioCategory[];
}

export interface PortfolioStatusBaseV2 {
    securitiesAccountNumber: string;
    cashAccountNumber: string;
    hasInvested: boolean;
    status: string;
}

export interface CryptoPortfolioStatusResponse extends PortfolioStatusBaseV2 {
    hasEnrolled: boolean;
}

export type FixedIncomePortfolioStatusResponse = PortfolioStatusBaseV2;

export interface PrivateMarketsPortfolioStatusResponse extends PortfolioStatusBaseV2 {
    termsRequired: boolean;
}

export interface PrivateMarketsPositionsResponse {
    positions: unknown[];
}

export interface WsError {
    errorCode: string;
    errorField: string | null;
    errorMessage: string;
    meta: { source: string };
}

export interface TickerV2Response {
    time: number;
    bidPrice: string;
    askPrice: string;
    bidSize: string;
    askSize: string;
    prePrice: string;
    openPrice: string;
    unit: string;
    errors?: WsError[];
}

export interface TapeResponse {
    time: number;
    price: string;
    size: string;
    side: "buy" | "sell";
    unit: string;
    sourceCurrency: string;
}

export interface PriceForOrderV2Response {
    time: number;
    price: string;
    bidPrice: string;
    askPrice: string;
    unit: string;
}

export interface TradingStatusResponse {
    status: string;
    timestamp: number;
}

export interface TradeAggregateEntry {
    time: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
}

export interface TradeAggregateHistoryResponse {
    expectedClosingTime: number;
    resolution: number;          // ms
    lastAggregateEndTime: number;
    aggregates: TradeAggregateEntry[];
    unit: string;
    sourceCurrency: string;
}

export interface KpiFiscalPeriod {
    type: string;
    number: number;
    year: number;
}

export interface KpiPeriodValue {
    year: number;
    quarter: number | null;
    reportingDate: string;
    yoyGrowth?: number;
    margin?: number;
}

export interface KpiEstimateValue {
    year: number;
    quarter: number;
    actual: number | null;
    actualCurrency: string | null;
    estimated: number | null;
    estimatedCurrency: string | null;
    forecast?: number;
    forecastCurrency?: string;
    fiscalPeriod: KpiFiscalPeriod;
    reportingDate: string;
}

export interface StockDetailKpisSet {
    revenues: (KpiPeriodValue & { revenue: number; revenueCurrency: string })[];
    ebitdas: (KpiPeriodValue & { ebitda: number; ebitdaCurrency: string })[];
    ebits: (KpiPeriodValue & { ebit: number; ebitCurrency: string })[];
    netIncomes: (KpiPeriodValue & { netIncome: number; netIncomeCurrency: string })[];
    grossProfits: (KpiPeriodValue & { grossProfit: number; grossProfitCurrency: string })[];
    preTaxProfits: (KpiPeriodValue & { preTaxProfit: number; preTaxProfitCurrency: string })[];
    afterTaxProfits: (KpiPeriodValue & { afterTaxProfit: number; afterTaxProfitCurrency: string })[];
    returnOnEquity: (KpiPeriodValue & { returnOnEquity: number })[];
    returnOnAssets: (KpiPeriodValue & { returnOnAssets: number })[];
    eps: KpiEstimateValue[];
    bookValuePerShare: KpiEstimateValue[];
}

export interface StockDetailKpisResponse extends StockDetailKpisSet {
    quarterly: StockDetailKpisSet;
}

export interface NeonSearchAggregationBucket {
    id: string;
    name: string;
    type: "sector" | "issuer" | "region" | "index" | "country" | "attribute" | string;
    icon: string;
    count: number;
}
export interface NeonSearchAggregationsResponse {
    results: NeonSearchAggregationBucket[];
    resultCount: number;
    correlationId: string;
}

export interface YieldToMaturityResponse {
    isin: string;
    quotation: string;
    yieldToMaturity: string;
    timestamp: string;
}

export interface DerivativeResult {
    isin: string;
    optionType: "call" | "put" | "long" | "short" | string;
    productCategoryName: string;
    nextGenProductCategoryName: string;
    barrier: number | null;
    leverage: number | null;
    strike: number | null;
    size: number | null;
    factor: number | null;
    delta: number | null;
    currency: string;
    expiry: string | null;
    issuerDisplayName: string;
    issuer: string;
    issuerImageId: string;
    imageId: string;
}

export interface DerivativesResponse {
    results: DerivativeResult[];
    resultCount: number;
    issuerCount: Record<string, number>;
    cursors: { before: string | null; after: string | null };
}

export interface EtfMetrics {
    peRatio: number | null;
    pbRatio: number | null;
    yield: number | null;
    assetsUnderManagement: number | null;
    assetsUnderManagementCurrency: string | null;
    beta: number | null;
    deviation: number | null;
}

export interface EtfCompositionEntry {
    isin: string;
    name: string;
    marketValue: number;
    holdingPercent: number;
    tags: (Tag & { icon?: string; imageId?: string })[];
}

export interface EtfAggregatedDistribution {
    periodStartDate: string;
    projected: number | null;
    yieldValue: number | null;
    amount: number | null;
    amountCurrency: string | null;
    count: number | null;
    projectedCount: number | null;
    price: number | null;
    priceCurrency: string | null;
}

export interface EtfDetails {
    isin: string;
    wkn: string;
    name: string;
    inceptionDate: string;
    domicile: string;
    replicationMethod: string;
    rebalancingInterval: string;
    totalExpenseRatio: number;
    underlyingIndex: string;
    distributionFrequency: string;
    distributionPolicy: string; // "accumulating" | "distributing" | ...
    type: string;
    issuer: string;
    composition: EtfCompositionEntry[];
    totalCompositionCount: number;
    focus: string[];
    exposure: unknown;
    metrics: EtfMetrics;
    distributions: unknown[];
    totalDistributionCount: number;
    aggregatedDistributions: EtfAggregatedDistribution[];
}

export type MessageResponseMap = {
    customerPermissions: { permissions: string[] };
    compactPortfolioByType: Portfolio;
    portfolioStatus: PortfolioStatusResponse;
    orders: { orders: unknown[]; unsupportedOrderCount: number };
    cash: CashBalance[];
    availableCash: CashBalance[];
    availableCashForPayout: CashBalance[];
    neonSearch: { results: SearchResult[]; resultCount: number; correlationId: string };
    neonSearchSuggestedTags: { tags: Tag[] };
    instrument: Instrument;
    homeInstrumentExchange: ExchangeInfo;
    savingsPlans: { savingsPlans: unknown[] };
    savingsPlanParameters: SavingsPlanParameters;
    timelineSavingsPlanOverview: unknown;
    createSavingsPlan: { id: string };
    changeSavingsPlan: { id: string };
    cancelSavingsPlan: unknown;
    ticker: TickerResponse;
    namedWatchlist: Watchlist;
    frontendExperiment: unknown;
    userPortfolioChartModifiedDietz: unknown;
    fincrimeBanner: { carouselItems: unknown[] };
    tradingPerkConditionStatus: { tradingPerkConditionStatus: unknown };
    watchlists: { watchlists: Watchlist[] };
    timelineActionsV2: { items: unknown[] };
    timelineTransactions: { items: TimelineEntry[]; cursors: Record<string, string | null>; startingTransactionId: string | null };
    timelineActivityLog: { items: TimelineEntry[]; cursors: Record<string, string | null> };
    timelineDetailV2: unknown;
    collection: Watchlist;
    availableSize: { size: string };
    aggregateHistoryLight: AggregateHistoryLightResponse;
    priceForOrder: PriceForOrderResponse;
    stockDetails: StockDetails;
    performance: PerformanceResponse;
    yieldToMaturity: YieldToMaturityResponse;
    neonNews: NeonNewsItem[];
    instrumentSuitability: { suitable: boolean };
    simpleCreateOrder: { id: string };
    derivatives: DerivativesResponse;
    accountPairs: { authAccountId: string; accounts: AccountPair[] };
    neonSearchAggregations: NeonSearchAggregationsResponse;
    etfDetails: EtfDetails;
    removeFromWatchlist: unknown;
    addToWatchlist: unknown;
    etfComposition: unknown;
    cancelOrder: unknown;
    stockDetailDividends: unknown;
    bondValuation: BondValuation;
    neonSearchTags: { tags: Tag[] };
    compactPortfolioByTypeV2: CompactPortfolioByTypeV2Response;
    cryptoPortfolioStatus: CryptoPortfolioStatusResponse;
    fixedIncomePortfolioStatus: FixedIncomePortfolioStatusResponse;
    privateMarketsPortfolioStatus: PrivateMarketsPortfolioStatusResponse;
    privateMarketsPositions: PrivateMarketsPositionsResponse;
    priceAlarms: unknown;
    priceForOrderV2: PriceForOrderV2Response;
    tape: TapeResponse;
    tickerV2: TickerV2Response;
    tradingStatus: TradingStatusResponse;
    tradeAggregateHistory: TradeAggregateHistoryResponse;
    bondValuationV2: BondValuation;
    stockDetailKpis: StockDetailKpisResponse;
};

export function createMessage<T extends keyof MessageTypeMap>(
    type: T,
    data?: Omit<MessageTypeMap[T], 'type'>
): MessageTypeMap[T] {
    return { type, ...data } as MessageTypeMap[T];
}