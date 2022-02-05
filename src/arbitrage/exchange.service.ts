import dotenv from "dotenv";
dotenv.config();
import ccxt from "ccxt.pro";
import got from "got";
import { Logger } from "tslog";

import type { Dictionary } from "./interfaces/market.interface";
import { LeanDocument } from "mongoose";
import { Arbitrage } from "./schemas/arbitrage.schema";
import { PairMarket } from "./interfaces/market.interface";
import { ProductBySymbolApiData } from "./interfaces/product-api.interface";
import { Market } from "ccxt";

const { BINANCE_API_KEY, BINANCE_API_SECRETKEY } = process.env;
const log: Logger = new Logger();

const exchangeClass = ccxt["binance"];

export const setupBinanceMarket = (markets?: Dictionary<Market>): ccxt.binance => {
    const exchange = new exchangeClass({
        apiKey: BINANCE_API_KEY,
        secret: BINANCE_API_SECRETKEY,
        timeout: 30000,
        enableRateLimit: true,
        newUpdates: true,
        markets: markets,
    });
    // exchange.verbose = true;
    return exchange;
};

export const generateMarketsFromArbitrageOpportunities = async (
    arbitrageOpportunities: LeanDocument<Arbitrage>[]
): Promise<Dictionary<Market>> => {
    const tempExchange = new exchangeClass({
        apiKey: BINANCE_API_KEY,
        secret: BINANCE_API_SECRETKEY,
        timeout: 30000,
        enableRateLimit: true,
        newUpdates: true,
    });

    await tempExchange.loadMarkets(true);

    const actualMarkets = tempExchange.markets;

    const markets = await Promise.all(
        arbitrageOpportunities.map(async (arbitrageOpportunity) => {
            const counterStables = [];
            let counterCrypto;
            const hasBusd =
                arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
                    return tokenPair.toLowerCase().includes("busd");
                }).length > 0;

            const hasUsdt =
                arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
                    return tokenPair.toLowerCase().includes("usdt");
                }).length > 0;

            const hasEth =
                arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
                    return tokenPair.toLowerCase().includes("eth");
                }).length > 0;

            const hasBtc =
                arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
                    return tokenPair.toLowerCase().includes("btc");
                }).length > 0;

            if (hasBusd) {
                counterStables.push("BUSD");
            }
            if (hasUsdt) {
                counterStables.push("USDT");
            }

            if (hasEth) {
                counterCrypto = "ETH";
            } else if (hasBtc) {
                counterCrypto = "BTC";
            }
            log.debug(arbitrageOpportunity);
            return generateMarket(arbitrageOpportunity.tokenCode, counterStables, counterCrypto);
        })
    );
    const flattened = markets.flat();
    // const dict = Object.assign({}, ...flattened.map((x) => ({ [x.marketName]: x.market })));
    const flattenedDict = flattened.reduce((a, x) => ({ ...a, [x.marketName]: x.market }), {}) as Dictionary<Market>;
    //FIXME: #FML i can't get types to work on this one. WTF

    return { ...flattenedDict, ...actualMarkets };
};

export const generateMarket = async (
    symbolName: string,
    counterStableCoins: string[],
    counterCrypto?: string
): Promise<PairMarket[]> => {
    const stablecoinMarkets = await Promise.all(
        counterStableCoins.map(async (stableCoin) => {
            log.debug(`getting product data for ${symbolName.toUpperCase()}/${stableCoin.toUpperCase()}`);
            const productDataUrl = `https://www.binance.com/gateway-api/v2/public/asset-service/product/get-product-by-symbol?symbol=${symbolName.toUpperCase()}${stableCoin.toUpperCase()}`;
            const productData = await got(productDataUrl).json<ProductBySymbolApiData>();
            log.debug(productData);
            const amountPrecision = decimalPlaces(+productData.data.i);
            const pricePrecision = decimalPlaces(+productData.data.ts);
            return {
                marketName: `${symbolName.toUpperCase()}/${stableCoin.toUpperCase()}`,
                market: {
                    limits: {
                        amount: { min: 0.00001, max: 10000000 },
                        price: { min: 0.00001, max: 10000000 },
                        cost: { min: 0.00001, max: 10000000 },
                        market: { min: 0.00001, max: 10000000 },
                    },
                    precision: { base: 8, quote: 8, amount: amountPrecision, price: pricePrecision },
                    tierBased: false,
                    percentage: true,
                    taker: 0.001,
                    maker: 0.001,
                    id: `${symbolName.toUpperCase()}${stableCoin.toUpperCase()}`,
                    lowercaseId: `${symbolName.toLowerCase()}${stableCoin.toLowerCase()}`,
                    symbol: `${symbolName.toUpperCase()}/${stableCoin.toUpperCase()}`,
                    base: `${symbolName.toUpperCase()}`,
                    quote: `${stableCoin.toUpperCase()}`,
                    baseId: `${symbolName.toUpperCase()}`,
                    quoteId: `${stableCoin.toUpperCase()}`,
                    info: {
                        symbol: `${symbolName.toUpperCase()}${stableCoin.toUpperCase()}`,
                        status: "TRADING",
                        baseAsset: `${symbolName.toUpperCase()}`,
                        quoteAsset: `${stableCoin.toUpperCase()}`,
                        quotePrecision: 8,
                        quoteAssetPrecision: 8,
                        baseCommissionPrecision: 8,
                        quoteCommissionPrecision: 8,
                        orderTypes: ["LIMIT", "LIMIT_MAKER", "MARKET", "STOP_LOSS_LIMIT", "TAKE_PROFIT_LIMIT"],
                    },
                    type: "spot",
                    spot: true,
                    margin: true,
                    future: false,
                    delivery: false,
                    active: true,
                },
            } as PairMarket;
        })
    );

    if (counterCrypto) {
        const productDataUrl = `https://www.binance.com/gateway-api/v2/public/asset-service/product/get-product-by-symbol?symbol=${symbolName.toUpperCase()}${counterCrypto.toUpperCase()}`;
        log.debug(productDataUrl);
        const productData = await got(productDataUrl).json<ProductBySymbolApiData>();
        const amountPrecision = decimalPlaces(+productData.data.i);
        const pricePrecision = decimalPlaces(+productData.data.ts);
        const cryptoMarkets = [
            {
                marketName: `${symbolName.toUpperCase()}/${counterCrypto.toUpperCase()}`,
                market: {
                    limits: {
                        amount: { min: 0.00001, max: 1000000 },
                        price: { min: 0.00001, max: 1000000 },
                        cost: { min: 0.00001, max: 1000000 },
                        market: { min: 0.00001, max: 1000000 },
                    },
                    precision: { base: 8, quote: 8, amount: amountPrecision, price: pricePrecision },
                    tierBased: false,
                    percentage: true,
                    taker: 0.001,
                    maker: 0.001,
                    id: `${symbolName.toUpperCase()}${counterCrypto.toUpperCase()}`,
                    lowercaseId: `${symbolName.toLowerCase()}${counterCrypto.toLowerCase()}`,
                    symbol: `${symbolName.toUpperCase()}/${counterCrypto.toUpperCase()}`,
                    base: `${symbolName.toUpperCase()}`,
                    quote: `${counterCrypto.toUpperCase()}`,
                    baseId: `${symbolName.toUpperCase()}`,
                    quoteId: `${counterCrypto.toUpperCase()}`,
                    info: {
                        symbol: `${symbolName.toUpperCase()}${counterCrypto.toUpperCase()}`,
                        status: "TRADING",
                        baseAsset: `${symbolName.toUpperCase()}`,
                        quoteAsset: `${counterCrypto.toUpperCase()}`,
                        quotePrecision: 8,
                        quoteAssetPrecision: 8,
                        baseCommissionPrecision: 8,
                        quoteCommissionPrecision: 8,
                        orderTypes: ["LIMIT", "LIMIT_MAKER", "MARKET", "STOP_LOSS_LIMIT", "TAKE_PROFIT_LIMIT"],
                    },
                    type: "spot",
                    spot: true,
                    margin: true,
                    future: false,
                    delivery: false,
                    active: true,
                },
            },
        ] as PairMarket[];
        return [...stablecoinMarkets, ...cryptoMarkets];
    }

    return [...stablecoinMarkets];
};

const decimalPlaces = (n: number) => {
    const hasFraction = (n) => {
        return Math.abs(Math.round(n) - n) > 1e-10;
    };

    let count = 0;
    // multiply by increasing powers of 10 until the fractional part is ~ 0
    while (hasFraction(n * 10 ** count) && isFinite(10 ** count)) count++;
    return count;
};
