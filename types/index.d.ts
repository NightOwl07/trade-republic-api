// Generated by dts-bundle-generator v9.5.1

export interface Message<T extends string> {
	type: T;
}
export type MessageTypeMap = {
	customerPermissions: Message<"customerPermissions">;
	compactPortfolioByType: Message<"compactPortfolioByType">;
	portfolioStatus: Message<"portfolioStatus">;
	orders: Message<"orders"> & {
		terminated: boolean;
	};
	cash: Message<"cash">;
	availableCash: Message<"availableCash">;
	availableCashForPayout: Message<"availableCashForPayout">;
	neonSearch: Message<"neonSearch"> & {
		data: {
			q: string;
			page: number;
			pageSize: number;
			filter: {
				key: string;
				value: string;
			}[];
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
				availablePaymentMethods: string[];
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
			mode: string;
			type: string;
			size: number;
			expiry: {
				type: string;
			};
			sellFractions: boolean;
			lastClientPrice: number;
		};
		warningsShown: string[];
		clientProcessId: string;
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
};
export declare function createMessage<T extends keyof MessageTypeMap>(type: T, data?: Omit<MessageTypeMap[T], "type">): MessageTypeMap[T];
export declare class TRApi {
	private readonly phoneNo;
	private readonly pin;
	private readonly host;
	private readonly wss;
	private ws;
	private processId?;
	private cookies;
	private trSessionToken?;
	private trRefreshToken?;
	private subscriptions;
	private echoInterval;
	private subCount;
	constructor(phoneNo: string, pin: string);
	login(): Promise<void>;
	private performLogin;
	private verifyPin;
	private setupWebSocket;
	private request;
	private askQuestion;
	private extractCookie;
	subscribe<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void): void;
	subscribeOnce<T extends keyof MessageTypeMap>(message: Message<T>, callback: (data: string | null) => void): void;
	private subscribeInternal;
	private echo;
	private handleWebSocketMessage;
	private extractIdAndJson;
}
export interface Category {
	categoryType: string;
	positions: Position$1[];
}
interface Position$1 {
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

export {
	Position$1 as Position,
};

export {};
