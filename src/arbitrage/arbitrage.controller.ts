import SlidingWindow from "swstats";
import { Logger } from "tslog";
import {
    getArbitrageOpportunitiesByState,
    setArbitrageOpportunityState,
    isArbitrageOpportunityApproachingTradingStart,
    extractTradingPairs,
    TradingPairs,
    swapCurrency,
    PairBases,
    sell,
    buy,
    convertBaseToBusd,
} from "./arbitrage.service";
import { LeanDocument } from "mongoose";
import { Arbitrage } from "./schemas/arbitrage.schema";

import { calculateServertimeDrift } from "../timesync/timesync.controller";

import { generateMarketsFromArbitrageOpportunities, setupBinanceMarket } from "./exchange.service";
import { binance } from "ccxt.pro";
import type { Order, Balances } from "ccxt";

const ARB_SLIDING_WINDOW_DURATION = +process.env.ARB_SLIDING_WINDOW_DURATION || 50;

const log: Logger = new Logger();

export const waitForTradingStartDate = async (): Promise<void | LeanDocument<Arbitrage>[]> => {
    const availableArbitrageOpportunities = await getArbitrageOpportunitiesByState("waitingForArbitrage");
    console.log(availableArbitrageOpportunities);
    if (availableArbitrageOpportunities.length === 0) {
        // log.debug("found no arbitrage opportunities");
        return Promise.resolve();
    }

    return Promise.all(
        availableArbitrageOpportunities
            .filter((arbitrageOpportunity) => {
                return isArbitrageOpportunityApproachingTradingStart(arbitrageOpportunity);
            })
            .map(async (arbitrageOpportunity) => {
                log.debug(`${arbitrageOpportunity._id} is ready for abritrage`);
                return setArbitrageOpportunityState(arbitrageOpportunity._id, "readyForArbitrage");
            })
    );
};

export const initiateTrade = async (): Promise<void> => {
    const availableArbitrageOpportunities = await getArbitrageOpportunitiesByState("readyForArbitrage");
    if (availableArbitrageOpportunities.length === 0) {
        return Promise.resolve();
    }

    await Promise.all(
        availableArbitrageOpportunities.map(async (arbitrageOpportunity) => {
            return setArbitrageOpportunityState(arbitrageOpportunity._id, "inArbitrage");
        })
    );

    availableArbitrageOpportunities.map(async (arbitrageOpportunity) => {
        const tradingPairs = extractTradingPairs(arbitrageOpportunity);
        log.debug("extrated trading pairs:");
        log.debug(tradingPairs);
        return prepareForArbing(arbitrageOpportunity._id, arbitrageOpportunity.tokenCode, tradingPairs);
    });
};

const prepareForArbing = async (arbitrageId: string, tokenCode: string, tradingPairs: TradingPairs): Promise<void> => {
    const exchange = setupBinanceMarket();
    await exchange.loadMarkets();
    try {
        await bringBackToBUSD(exchange, tradingPairs);
        await spreadOutToAllBasePairs(exchange, tradingPairs);
        await arbTokens(arbitrageId, tokenCode, tradingPairs);
    } catch (error) {
        log.trace(error);
        await bringBackToBUSD(exchange, tradingPairs);
    }
};

function isOrder(orderResult: Order | void): orderResult is Order {
    return (orderResult as Order)?.remaining !== undefined;
}

const arbTokens = async (arbitrageId: string, tokenCode: string, tradingPairs: TradingPairs): Promise<void> => {
    log.debug(tokenCode);
    log.debug(tradingPairs);

    const currentArbitrageOpportunities = await getArbitrageOpportunitiesByState("inArbitrage");
    if (currentArbitrageOpportunities.length === 0) {
        return Promise.resolve();
    }

    const markets = await generateMarketsFromArbitrageOpportunities(currentArbitrageOpportunities);

    const exchange = setupBinanceMarket(markets);

    let sellLock = false;
    let firstTrade = true;

    let lockStatus = "none" as "none" | "bucket" | "first" | "initialBuy";

    let balances = await exchange.fetchBalance();

    log.debug("Measuring server latency...");
    const serverTimeDrift = await calculateServertimeDrift();
    log.debug(serverTimeDrift);

    log.debug(`Fetching crypto prices from binance...`);
    const btcUsdBuyPrice = await (await exchange.fetchTicker("BTC/BUSD")).ask;
    const ethUsdBuyPrice = await (await exchange.fetchTicker("ETH/BUSD")).ask;
    const bnbUsdBuyPrice = await (await exchange.fetchTicker("BNB/BUSD")).ask;

    log.debug(`Waiting for events from Binance Websocket...`);

    const timeBuckets = {};

    Object.keys(tradingPairs).map((tradingPairBase: PairBases) => {
        timeBuckets[tradingPairBase] = new SlidingWindow.TimeStats(10000, {
            step: ARB_SLIDING_WINDOW_DURATION,
            ops: ["avg"],
        });
    });

    let bucketEndTime;
    let consecutiveArbMisses = 0;

    await Promise.all(
        Object.keys(tradingPairs).map((tradingPairBase: PairBases) =>
            (async () => {
                const tradingPair = tradingPairs[tradingPairBase];
                while (!sellLock) {
                    try {
                        const newTrades = await exchange.watchTrades(tradingPair);
                        newTrades.forEach(async (trade) => {
                            // log.debug(`new trade, lock is ${lockStatus}`);
                            if (sellLock) {
                                // log.debug(`returning, sell lock is ${sellLock}`);
                                return;
                            }
                            if (!trade?.price || !trade?.timestamp) {
                                // log.debug(
                                //     `returning, trade price is ${trade?.price} , timestamp is ${trade?.timestamp}`
                                // );
                                return;
                            }

                            timeBuckets[tradingPairBase].push(trade.price);

                            if (firstTrade) {
                                // log.debug(`it's the first trade`);
                                lockStatus = "initialBuy";
                                firstTrade = false;
                                bucketEndTime = trade.timestamp + 1900;
                                purchaseFromAllAvailablePairs(exchange, balances, tradingPairs).then(() => {
                                    exchange.fetchBalance().then((newBalances) => {
                                        balances = newBalances;
                                        lockStatus = "first";
                                    });
                                });
                            }

                            if (trade.timestamp >= bucketEndTime && lockStatus === "first") {
                                // This is the first trade we will execute. We have an initial balance originating from the first buy, and just want to sell that.

                                // Force closing of arb for the $beta launch
                                await closeArbPosition(tradingPairs, arbitrageId, exchange);
                                return;

                                lockStatus = "bucket";
                                const bucketValues = calculateBucketValue(timeBuckets, tradingPairs, {
                                    btc: btcUsdBuyPrice,
                                    eth: ethUsdBuyPrice,
                                    bnb: bnbUsdBuyPrice,
                                    busd: 1,
                                    usdt: 1,
                                });

                                const sortedBuckets = Object.keys(tradingPairs)
                                    .map((tradingPairBase: PairBases) => {
                                        return tradingPairs[tradingPairBase];
                                    })
                                    .slice()
                                    .sort((a, b) => {
                                        return bucketValues[b] - bucketValues[a]; // sort descending
                                    });

                                // log.debug(JSON.stringify(sortedBuckets));
                                // log.debug(JSON.stringify(bucketValues));

                                const delta = Math.abs(
                                    bucketValues[sortedBuckets[0].split("/")[1].toLowerCase()] -
                                        bucketValues[
                                            sortedBuckets[sortedBuckets.length - 1].split("/")[1].toLowerCase()
                                        ]
                                );
                                // log.debug(`Inspecting bucket ${sortedBuckets[0].split("/")[1].toLowerCase()}`);
                                // log.debug(`Current bucket delta: ${delta}`);
                                // log.debug(
                                //     `Current bucket value: ${
                                //         bucketValues[sortedBuckets[0].split("/")[1].toLowerCase()]
                                //     }`
                                // );
                                const bucketPercentageSpread =
                                    (delta / bucketValues[sortedBuckets[0].split("/")[1].toLowerCase()]) * 100;

                                // log.debug(`Current bucket percentage spread: ${bucketPercentageSpread}`);
                                if (bucketPercentageSpread < 0.1) {
                                    // log.warn(`${consecutiveArbMisses} consecutive arb misses`);
                                    consecutiveArbMisses++;
                                }

                                // Sell the most expensive pair
                                const tokenBalance = balances[tokenCode].free;
                                // log.debug(`Selling ${tokenBalance} worth of ${sortedBuckets[0]}`);
                                await sell(sortedBuckets[0], tokenBalance, exchange);
                                balances = await exchange.fetchBalance();
                                bucketEndTime = trade.timestamp + ARB_SLIDING_WINDOW_DURATION;
                                lockStatus = "none";
                            }

                            if (trade.timestamp >= bucketEndTime && lockStatus === "none") {
                                // This is any subsequent trade. We will have a 0 balance initially, and will go and perform a swap if it's favorable to do so.
                                // log.debug(
                                //     `Bucket end time: ${bucketEndTime}, trade timestamp: ${trade.timestamp}, lockstatus: ${lockStatus}`
                                // );
                                lockStatus = "bucket";
                                const bucketValues = calculateBucketValue(timeBuckets, tradingPairs, {
                                    btc: btcUsdBuyPrice,
                                    eth: ethUsdBuyPrice,
                                    bnb: bnbUsdBuyPrice,
                                    busd: 1,
                                    usdt: 1,
                                });

                                const sortedBuckets = Object.keys(tradingPairs)
                                    .map((tradingPairBase: PairBases) => {
                                        return tradingPairs[tradingPairBase];
                                    })
                                    .slice()
                                    .sort((a, b) => {
                                        return bucketValues[b] - bucketValues[a]; // sort descending
                                    });

                                // log.debug(JSON.stringify(sortedBuckets));
                                // log.debug(JSON.stringify(bucketValues));

                                const delta = Math.abs(
                                    bucketValues[sortedBuckets[0].split("/")[1].toLowerCase()] -
                                        bucketValues[
                                            sortedBuckets[sortedBuckets.length - 1].split("/")[1].toLowerCase()
                                        ]
                                );
                                // log.debug(`Inspecting bucket ${sortedBuckets[0].split("/")[1].toLowerCase()}`);
                                // log.debug(`Current bucket delta: ${delta}`);
                                // log.debug(
                                //     `Current bucket value: ${
                                //         bucketValues[sortedBuckets[0].split("/")[1].toLowerCase()]
                                //     }`
                                // );
                                const bucketPercentageSpread =
                                    (delta / bucketValues[sortedBuckets[0].split("/")[1].toLowerCase()]) * 100;

                                // log.debug(`Current bucket percentage spread: ${bucketPercentageSpread}`);
                                if (bucketPercentageSpread < 2) {
                                    // log.warn(`${consecutiveArbMisses} consecutive arb misses`);
                                    consecutiveArbMisses++;
                                }

                                balances = await exchange.fetchBalance();

                                if (consecutiveArbMisses > 5) {
                                    log.debug(`Ending arbitrage due to 5 consecutive misses`);
                                    sellLock = true;
                                    await closeArbPosition(tradingPairs, arbitrageId, exchange);
                                    return;
                                }

                                // Swap to che base unit of the cheapest pair
                                const counterBalance = balances[sortedBuckets[0].split("/")[1]].free;
                                // log.debug(
                                //     `Swapping ${sortedBuckets[0].split("/")[1]} for ${
                                //         sortedBuckets[sortedBuckets.length - 1].split("/")[1]
                                //     }`
                                // );
                                const swapOrder = await swapCurrency(
                                    sortedBuckets[0].split("/")[1].toLowerCase() as PairBases,
                                    sortedBuckets[sortedBuckets.length - 1].split("/")[1].toLowerCase() as PairBases,
                                    counterBalance,
                                    exchange
                                );

                                if (isOrder(swapOrder)) {
                                    // log.info(`Remaining: ${swapOrder.remaining}`);
                                    // log.info(`Filled: ${swapOrder.filled}`);
                                }

                                balances = await exchange.fetchBalance();
                                // Buy the cheapest pair
                                const lowcostCounterBalance =
                                    balances[sortedBuckets[sortedBuckets.length - 1].split("/")[1]].free;
                                // log.debug(
                                //     `Buying ${lowcostCounterBalance} worth of ${
                                //         sortedBuckets[sortedBuckets.length - 1]
                                //     }`
                                // );
                                await buy(sortedBuckets[sortedBuckets.length - 1], lowcostCounterBalance, exchange);
                                balances = await exchange.fetchBalance();

                                // Sell the most expensive pair
                                const tokenBalance = balances[tokenCode].free;
                                // log.debug(`Selling ${tokenBalance} worth of ${sortedBuckets[0]}`);
                                await sell(sortedBuckets[0], tokenBalance, exchange);

                                bucketEndTime = trade.timestamp + ARB_SLIDING_WINDOW_DURATION;
                                lockStatus = "none";
                            }
                        });
                    } catch (e) {
                        log.error(tradingPair, e);
                        // do nothing and retry on next loop iteration
                    }
                }
            })()
        )
    );

    log.debug("Arb process complete");
    return Promise.resolve();
};

export const purchaseFromAllAvailablePairs = async (
    exchange: binance,
    balances: Balances,
    tradingPairs: TradingPairs
): Promise<Order[]> => {
    await exchange.loadMarkets(true); // attempt to reload markets so we can purchase. This might cause a blocking condition, so not sure.
    return Promise.all(
        Object.keys(tradingPairs).map((tradingPairBase: PairBases) => {
            const tradingPair = tradingPairs[tradingPairBase];
            log.debug(tradingPair);
            const availableBalance = balances[tradingPair.split("/")[1].toUpperCase()].free;
            log.info(JSON.stringify(balances[tradingPair.split("/")[1].toUpperCase()]));
            return buy(tradingPair, availableBalance, exchange);
        })
    );
};

const spreadOutToAllBasePairs = async (exchange: binance, tradingPairs: TradingPairs): Promise<(void | Order)[]> => {
    const balances = await exchange.fetchBalance();
    const availableBusd = balances["BUSD"].free;

    const UsdValueForPair = Math.floor(availableBusd / Object.keys(tradingPairs).length) - 1; //Magic number so we attempt to not run into cases where we try to buy more than we have due to usdt/busd/ustc price differences

    log.debug(`Keys available for tradingpairs are: ${Object.keys(tradingPairs)}`);

    return Promise.all(
        Object.keys(tradingPairs).map((tradingPairBase: PairBases) => {
            return swapCurrency("busd", tradingPairBase, UsdValueForPair, exchange);
        })
    );
};

const bringBackToBUSD = async (exchange: binance, tradingPairs: TradingPairs): Promise<(void | Order)[]> => {
    const balances = await exchange.fetchBalance();

    return Promise.all(
        Object.keys(tradingPairs).map(async (tradingPairBase: PairBases) => {
            const availableBaseAmount = balances.free[tradingPairBase.toUpperCase()];
            const BusdAmount = await convertBaseToBusd(tradingPairBase, availableBaseAmount, exchange);
            try {
                return await swapCurrency(tradingPairBase, "busd", BusdAmount, exchange);
            } catch (error) {
                log.debug(`failed processing ${availableBaseAmount} worth of ${tradingPairBase}`);
                log.trace(error);
            }
        })
    );
};

export type TimeBuckets = Record<Partial<PairBases>, number>;

export const calculateBucketValue = (
    timeBucket: { [x: string]: { stats: { avg: number } } },
    tradingPairs: TradingPairs,
    prices: { btc?: number; eth?: number; bnb?: number; busd?: number; usdt?: number }
): TimeBuckets => {
    const pairs = Object.keys(tradingPairs);
    const hashmap = {} as TimeBuckets;
    pairs.forEach((pairbase: PairBases) => {
        hashmap[pairbase] = timeBucket[pairbase].stats.avg * prices[pairbase];
    });
    return hashmap;
};

const closeArbPosition = async (tradingPairs: TradingPairs, arbitrageId: string, exchange: binance) => {
    log.debug(`Concluding arb}`);
    await bringBackToBUSD(exchange, tradingPairs);
    await setArbitrageOpportunityState(arbitrageId, "soldOnBinance");
};
