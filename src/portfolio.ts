export interface Category {
    categoryType: string;
    positions: Position[];
}

export interface Position {
    instrumentType: string;
    name: string;
    derivativeInfo?: DerivativeInfo | null;
    bondInfo?: any | null;
    imageId: string;
    isin: string;
    averageBuyIn: string;
    netSize: string;
}

export interface DerivativeInfo {
    categoryType: string;
    productCategoryName: string;
    nextGenProductCategoryName: string;
    productGroupType: string;
    knocked: boolean;
    underlying: Underlying;
    properties: Properties;
    mifid: Mifid;
    issuerCountry: string;
    emissionDate: string;
}

export interface Underlying {
    name: string;
    isin: string;
    shortName: string;
    available: boolean;
}

export interface Properties {
    strike: number;
    barrier?: number | null;
    cap?: number | null;
    factor?: number | null;
    currency: string;
    size: number;
    expiry?: string | null;
    maturity?: string | null;
    exerciseType: string;
    settlementType: string;
    optionType: string;
    quoteType: string;
    firstTradingDay: string;
    lastTradingDay?: string | null;
    delta?: number | null;
    leverage: number;
    managementFee?: number | null;
}

export interface Mifid {
    entryCost: number;
    exitCost: number;
    ongoingCostsExpected: number;
    ongoingCostsAccumulated: number;
    costNotation: string;
}

export interface Portfolio {
    categories: Category[];
    products: any[];
}