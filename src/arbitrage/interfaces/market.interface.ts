export interface Amount {
    min: number;
    max: number;
}

export interface Price {
    min: number;
    max: number;
}

export interface Cost {
    min: number;
    max: number;
}

export interface Market {
    min: number;
    max: number;
}

export interface Limits {
    amount: Amount;
    price: Price;
    cost: Cost;
    market: Market;
}

export interface Precision {
    base: number;
    quote: number;
    amount: number;
    price: number;
}

export interface Info {
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    quotePrecision: number;
    quoteAssetPrecision: number;
    baseCommissionPrecision: number;
    quoteCommissionPrecision: number;
    orderTypes: string[];
}

export interface TradingMarket {
    limits: Limits;
    precision: Precision;
    tierBased: boolean;
    percentage: boolean;
    taker: number;
    maker: number;
    id: string;
    lowercaseId: string;
    symbol: string;
    base: string;
    quote: string;
    baseId: string;
    quoteId: string;
    info: Info;
    type: string;
    spot: boolean;
    margin: boolean;
    future: boolean;
    delivery: boolean;
    active: boolean;
}

export interface PairMarket {
    marketName: string;
    market: TradingMarket;
}

export interface Dictionary<T> {
    [key: string]: T;
}
