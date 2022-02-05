import dotenv from "dotenv";
dotenv.config();

import ArbitrageSchema, { Arbitrage, ArbitrageState } from "./schemas/arbitrage.schema";
import { Logger } from "tslog";
import isAfter from "date-fns/isAfter";
import sub from "date-fns/sub";
import { LeanDocument } from "mongoose";
import { binance } from "ccxt.pro";
import { Order, Params } from "ccxt";

const log: Logger = new Logger();

export const getArbitrageOpportunitiesByState = async (state: ArbitrageState): Promise<LeanDocument<Arbitrage>[]> => {
    return ArbitrageSchema.find({ state: state }).lean().exec();
};

export const setArbitrageOpportunityState = async (
    id: string,
    state: ArbitrageState
): Promise<LeanDocument<Arbitrage>> => {
    return ArbitrageSchema.findByIdAndUpdate(id, { state: state }, { new: true }).lean().exec();
};

export const isArbitrageOpportunityApproachingTradingStart = (
    arbitrageOpportunity: LeanDocument<Arbitrage>
): boolean => {
    const triggerDate = sub(new Date(arbitrageOpportunity.tradingStartDate), {
        minutes: 1,
    });

    if (isAfter(new Date(), triggerDate)) {
        log.info(
            "Arbitrage opportunity trading start is approaching in 1 minutes or less. Marking as ready for trading"
        );
        return true;
    }
    log.info("Waiting for trading date to approach....");
    return false;
};

// export interface BaseOfPair {
//     usd: string;
//     busd: string;
//     eth: string;
//     btc: string;
//     bnb: string;
// }

export type PairBases = "usdt" | "busd" | "bnb" | "eth" | "btc";
export type TradingPairs = Record<Partial<PairBases>, string>;

export const extractTradingPairs = (arbitrageOpportunity: LeanDocument<Arbitrage>): TradingPairs => {
    const tradingPairs = {} as TradingPairs;

    const busdPair = arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
        return tokenPair.toLowerCase().includes("busd");
    });
    if (busdPair && busdPair[0]) {
        tradingPairs.busd = busdPair[0];
    }

    const usdtPair = arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
        return tokenPair.toLowerCase().includes("usdt");
    });

    if (usdtPair && usdtPair[0]) {
        tradingPairs.usdt = usdtPair[0];
    }

    const bnbPair = arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
        return tokenPair.toLowerCase().includes("bnb");
    });

    if (bnbPair && bnbPair[0]) {
        tradingPairs.bnb = bnbPair[0];
    }

    const ethPair = arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
        return tokenPair.toLowerCase().includes("eth");
    });

    if (ethPair && ethPair[0]) {
        tradingPairs.eth = ethPair[0];
    }

    const btcPair = arbitrageOpportunity.tokenPairs.filter((tokenPair) => {
        return tokenPair.toLowerCase().includes("btc");
    });

    if (btcPair && btcPair[0]) {
        tradingPairs.btc = btcPair[0];
    }

    return tradingPairs;
};

export const tryToCreateOrder = async (
    exchange: binance,
    symbol: string,
    type: string,
    side: "buy" | "sell",
    amount?: number,
    price?: number,
    params?: Params
): Promise<Order | boolean> => {
    try {
        const order = await exchange.createOrder(symbol, type, side, amount, price, params);
        return order;
    } catch (e) {
        log.error(e.constructor.name, e.message);
        return false;
    }
};

export const buy = async (tradingPair: string, amountToBuy: number, exchange: binance): Promise<Order> => {
    let order: boolean | Order = false;
    while (true) {
        log.debug(`Attempting to buy ${amountToBuy} ${tradingPair}`);
        order = await tryToCreateOrder(exchange, tradingPair, "market", "buy", null, null, {
            quoteOrderQty: amountToBuy,
        });
        if (order !== false) {
            break;
        }
    }
    if (order) {
        return order as Order;
    }
};

export const sell = async (tradingPair: string, amountToSell: number, exchange: binance): Promise<Order> => {
    let order: boolean | Order = false;

    while (true) {
        log.debug(`Attempting to sell ${amountToSell} ${tradingPair}`);
        order = await tryToCreateOrder(
            exchange,
            tradingPair,
            "market",
            "sell",
            exchange.amount_to_precision(tradingPair, amountToSell)
        );
        if (order !== false) {
            break;
        }
    }
    if (order) {
        return order as Order;
    }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const checkMinimumAmount = (usdAmount: number, _exchange: binance, _market: string): boolean => {
    if (usdAmount >= 10) {
        return true;
    }
    return false;
};

export const convertBaseToBusd = async (
    from: PairBases,
    availableBaseAmount: number,
    exchange: binance
): Promise<number> => {
    let busdPrice: number;
    switch (from) {
        case "usdt":
            busdPrice = (await exchange.fetchTicker("BUSD/USDT")).ask;
            return availableBaseAmount * busdPrice;
        case "busd":
            return availableBaseAmount;
        case "bnb":
            busdPrice = (await exchange.fetchTicker("BNB/BUSD")).bid;
            return availableBaseAmount * busdPrice;
        case "eth":
            busdPrice = (await exchange.fetchTicker("ETH/BUSD")).bid;
            return availableBaseAmount * busdPrice;

        case "btc":
            busdPrice = (await exchange.fetchTicker("BTC/BUSD")).bid;
            return availableBaseAmount * busdPrice;

        default:
            throw new Error("unknown base in conversion: " + from);
    }
};

export const swapCurrency = async (
    from: PairBases,
    to: PairBases,
    amount: number,
    exchange: binance
): Promise<Order | void> => {
    log.debug(`swapping ${amount} ${from}/${to}`);
    let orderQty: number;
    let calculatedAmount: number;
    let availableAmount: number;
    let sellableAmount: number;
    const balances = await exchange.fetchBalance();
    switch (from) {
        case "usdt":
            switch (to) {
                case "busd":
                    orderQty = exchange.amount_to_precision("BUSD/USDT", amount);
                    log.debug(`orderQty: ${orderQty}; amount: ${amount};`);
                    if (checkMinimumAmount(amount, exchange, "BUSD/USDT")) {
                        log.debug("proceeding with BUSD/USDT order");
                        return exchange.createOrder("BUSD/USDT", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "bnb":
                    orderQty = exchange.amount_to_precision("BNB/USDT", amount);
                    if (checkMinimumAmount(amount, exchange, "BNB/USDT")) {
                        return exchange.createOrder("BNB/USDT", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "eth":
                    orderQty = exchange.amount_to_precision("ETH/USDT", amount);
                    if (checkMinimumAmount(amount, exchange, "ETH/USDT")) {
                        return exchange.createOrder("ETH/USDT", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();

                case "btc":
                    orderQty = exchange.amount_to_precision("BTC/USDT", amount);
                    if (checkMinimumAmount(amount, exchange, "BTC/USDT")) {
                        return exchange.createOrder("BTC/USDT", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
            }
            break;
        case "busd":
            switch (to) {
                case "usdt":
                    const BusdUsdtSellPrice = (await exchange.fetchTicker("BUSD/USDT")).bid;
                    calculatedAmount = amount * BusdUsdtSellPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BUSD/USDT", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "BUSD/USDT")) {
                        return exchange.createOrder("BUSD/USDT", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "bnb":
                    orderQty = exchange.amount_to_precision("BNB/BUSD", amount);
                    if (checkMinimumAmount(amount, exchange, "BNB/BUSD")) {
                        return exchange.createOrder("BNB/BUSD", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "eth":
                    orderQty = exchange.amount_to_precision("ETH/BUSD", amount);
                    if (checkMinimumAmount(amount, exchange, "ETH/BUSD")) {
                        return exchange.createOrder("ETH/BUSD", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "btc":
                    orderQty = exchange.amount_to_precision("BTC/BUSD", amount);

                    if (checkMinimumAmount(amount, exchange, "BTC/BUSD")) {
                        log.warn(`Creating BUSD/BTC Order for: ${orderQty}`);
                        return exchange.createOrder("BTC/BUSD", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
            }
            break;
        case "bnb":
            const BnbBusdPrice = (await exchange.fetchTicker("BNB/BUSD")).bid;
            const BnbUsdtPrice = (await exchange.fetchTicker("BNB/USDT")).bid;
            switch (to) {
                case "usdt":
                    calculatedAmount = amount * BnbUsdtPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BNB/USDT", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "BNB/USDT")) {
                        return exchange.createOrder("BNB/USDT", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "busd":
                    calculatedAmount = amount * BnbBusdPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BNB/BUSD", sellableAmount);
                    log.debug(`orderQty: ${orderQty}; amount: ${amount};`);
                    if (checkMinimumAmount(amount, exchange, "BNB/BUSD")) {
                        log.debug("proceeding with BNB/BUSD order");
                        return exchange.createOrder("BNB/BUSD", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "eth":
                    calculatedAmount = amount * BnbBusdPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BNB/ETH", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "BNB/ETH")) {
                        return exchange.createOrder("BNB/ETH", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "btc":
                    calculatedAmount = amount * BnbBusdPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BNB/BTC", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "BNB/BTC")) {
                        return exchange.createOrder("BNB/BTC", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
            }
            break;
        case "eth":
            const EthUsdtPrice = (await exchange.fetchTicker("ETH/USDT")).bid;
            const EthBusdPrice = (await exchange.fetchTicker("ETH/USDT")).bid;
            switch (to) {
                case "usdt":
                    calculatedAmount = amount * EthUsdtPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("ETH/USDT", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "ETH/USDT")) {
                        return exchange.createOrder("ETH/USDT", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "busd":
                    calculatedAmount = amount * EthBusdPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("ETH/BUSD", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "ETH/BUSD")) {
                        return exchange.createOrder("ETH/BUSD", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "bnb":
                    const EthBusdBuyPrice = (await exchange.fetchTicker("ETH/BUSD")).bid;
                    orderQty = exchange.amount_to_precision("BNB/ETH", amount / EthBusdBuyPrice);
                    if (checkMinimumAmount(amount, exchange, "BNB/ETH")) {
                        return exchange.createOrder("BNB/ETH", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "btc":
                    calculatedAmount = amount / EthBusdPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("ETH/BTC", sellableAmount);
                    if (checkMinimumAmount(amount, exchange, "ETH/BTC")) {
                        return exchange.createOrder("ETH/BTC", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
            }
            break;
        case "btc":
            const BtcBusdSellPrice = (await exchange.fetchTicker("BTC/BUSD")).bid;
            const BtcBusdBuyPrice = (await exchange.fetchTicker("BTC/BUSD")).ask;
            switch (to) {
                case "usdt":
                    calculatedAmount = amount / BtcBusdSellPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BTC/USDT", sellableAmount);

                    if (checkMinimumAmount(amount, exchange, "BTC/USDT")) {
                        return exchange.createOrder("BTC/USDT", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "busd":
                    calculatedAmount = amount * BtcBusdSellPrice;
                    availableAmount = balances[from.toUpperCase()].free;
                    sellableAmount = calculatedAmount > availableAmount ? availableAmount : calculatedAmount;
                    orderQty = exchange.amount_to_precision("BTC/BUSD", sellableAmount);
                    log.debug(`orderQty: ${orderQty}; amount: ${amount}; BtcBusdSellPrice: ${BtcBusdSellPrice}`);
                    if (checkMinimumAmount(amount, exchange, "BTC/BUSD")) {
                        log.debug("proceeding with BTC/BUSD order");
                        return exchange.createOrder("BTC/BUSD", "market", "sell", orderQty);
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "bnb":
                    orderQty = exchange.amount_to_precision("BNB/BTC", amount / BtcBusdBuyPrice);
                    if (checkMinimumAmount(amount, exchange, "BNB/BTC")) {
                        return exchange.createOrder("BNB/BTC", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
                case "eth":
                    orderQty = exchange.amount_to_precision("ETH/BTC", amount / BtcBusdBuyPrice);
                    if (checkMinimumAmount(amount, exchange, "ETH/BTC")) {
                        return exchange.createOrder("ETH/BTC", "market", "buy", null, null, {
                            quoteOrderQty: orderQty,
                        });
                    }
                    log.warn(`Minimum amount not met: ${amount}`);
                    return Promise.resolve();
            }
            break;
        default:
            break;
    }
};
