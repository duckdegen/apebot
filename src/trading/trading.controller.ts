import ccxt from "ccxt.pro";
import { Logger } from "tslog";
import { findPurchasedTokens, markPurchasedTokensAsInTrading } from "../coin-analysis/coin-analysis.service";
import { calculateServertimeDrift } from "../timesync/timesync.controller";
import { getWalletBalanceForERC20Token } from "../wallet/wallet.controller";
import { changeTokenStatus, findTokensByStatus, importTradeableToken /*sendToBinance*/ } from "./trading.service";
// import { getGasPrice } from "../apis/gasNow";
import isAfter from "date-fns/isAfter";
import sub from "date-fns/sub";
import { TradeableToken } from "./schemas/tradeable-token.schema";
import { LeanDocument } from "mongoose";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || null;
const BINANCE_API_SECRETKEY = process.env.BINANCE_API_SECRETKEY || null;
// const BINANCE_WALLET_ADDRESS = process.env.BINANCE_WALLET_ADDRESS || null;
const MY_ETHEREUM_ADDRESS = process.env.MY_ETHEREUM_ADDRESS || null;

const TIME_TO_WAIT_BEFORE_SELLING = +process.env.TIME_TO_WAIT_BEFORE_SELLING || 1100;
// const SEND_TO_BINANCE_GAS_MULTIPLIER = +process.env.SEND_TO_BINANCE_GAS_MULTIPLIER || 1.5;
const TIME_TO_LEAVE_LIMIT_ORDER_ACTIVE = +process.env.TIME_TO_LEAVE_LIMIT_ORDER_ACTIVE || 150;
const AMOUNT_OF_TOP_PRICES_TO_DISCARD = +process.env.AMOUNT_OF_TOP_PRICES_TO_DISCARD || 5;

const exchangeClass = ccxt["binance"];

export const setupBinanceMarket = (): ccxt.binance => {
    const exchange = new exchangeClass({
        apiKey: BINANCE_API_KEY,
        secret: BINANCE_API_SECRETKEY,
        timeout: 30000,
        enableRateLimit: true,
        newUpdates: true,
    });
    // exchange.verbose = true;
    return exchange;
};

export const processPurchasedTokens = async (): Promise<void | TradeableToken[]> => {
    const purchasedTokenList = await findPurchasedTokens();
    if (purchasedTokenList.length === 0) {
        return Promise.resolve();
    }

    //Immediately mark the purchased tokens as locked for further trading so they cannot be imported again
    await Promise.all(
        purchasedTokenList.map(async (token) => {
            return markPurchasedTokensAsInTrading(token.tokenCode);
        })
    );

    log.debug("Completed trading lock");
    await Promise.all(
        purchasedTokenList.map(async (token) => {
            const walletBalanceInWei = await getWalletBalanceForERC20Token(token.tokenContract);
            if (walletBalanceInWei.eq(0) || !walletBalanceInWei) {
                log.error("Balance for erc20 token was 0");
                return;
            }
            log.info(`Balance for erc20 token is ${walletBalanceInWei}`);
            return importTradeableToken({
                tokenCode: token.tokenCode.toUpperCase(),
                tokenContract: token.tokenContract,
                tokenPairs: token.tokenPairs.map((pair) => pair.toUpperCase()),
                tradingStartDate: token.tradingStartDate,
                tokenAmountInWei: walletBalanceInWei,
                purchasePriceInWei: token.priceInWei,
                sellPriceInUSD: token.priceInWei.dividedBy(100000000).times(0.00000038).toNumber(),
            });
        })
    );
    log.debug("Completed importing token to trading");
};

export const moveOwnedTokensToBinance = async (): Promise<void | LeanDocument<TradeableToken>[]> => {
    const ownedTokenList = await findTokensByStatus("purchased");
    if (ownedTokenList.length === 0) {
        return Promise.resolve();
    }

    await Promise.all(
        ownedTokenList.map((token) => {
            return changeTokenStatus(token.tokenCode, "sendingToBinance");
        })
    );

    // const currentGasPrice = (await getGasPrice()).times(SEND_TO_BINANCE_GAS_MULTIPLIER);

    return Promise.all(
        ownedTokenList.map(async (token) => {
            try {
                // await sendToBinance({
                //     gasPrice: currentGasPrice,
                //     myAddress: MY_ETHEREUM_ADDRESS,
                //     binanceAddress: BINANCE_WALLET_ADDRESS,
                //     tokenContract: token.tokenContract,
                // });
                log.info("Tokens will manually be sent to binance");
                return changeTokenStatus(token.tokenCode, "sentToBinance");
            } catch (error) {
                log.error("Tokens transfer to binance failed. Reverting status to `purchased`");
                log.trace(error);
                await changeTokenStatus(token.tokenCode, "purchased");
                throw new Error(error);
            }
        })
    );
};

export const checkIfBalanceIsAvailable = async (): Promise<void | (void | LeanDocument<TradeableToken>)[]> => {
    const tokenList = await findTokensByStatus("sentToBinance");
    if (tokenList.length === 0) {
        // log.debug("No new tokens marked as pending arrival");
        return Promise.resolve();
    }
    const exchange = setupBinanceMarket();
    const balances = await exchange.fetchBalance();

    return Promise.all(
        tokenList.map(async (token) => {
            // log.debug(token);
            const availableBalance = balances.free[token.tokenCode];
            if (availableBalance && availableBalance > 0) {
                log.info(
                    `Balance of ${availableBalance} $${token.tokenCode} have been detected on Binance. Marking as Available.`
                );
                return changeTokenStatus(token.tokenCode, "availableOnBinance");
            }
            log.debug(`Waiting for ${token.tokenCode} to arrive on binance`);
            return Promise.resolve();
        })
    );
};

export const waitForTradingStartDate = async (): Promise<(void | LeanDocument<TradeableToken>)[]> => {
    const tokenList = await findTokensByStatus("availableOnBinance");
    if (tokenList.length === 0) {
        return;
    }

    return Promise.all(
        tokenList.map(async (token) => {
            const triggerDate = sub(new Date(token.tradingStartDate), {
                minutes: 5,
            });

            if (isAfter(new Date(), triggerDate)) {
                log.debug(`Trigger date: ${triggerDate.toISOString()}`);
                log.debug(`Current date: ${new Date().toISOString()}`);
                log.info("Trading is starting soon. Marking as ready for trading");
                return changeTokenStatus(token.tokenCode, "readyForTrading");
            }
            log.info("Waiting for trading to begin....");
            return Promise.resolve();
        })
    );
};

export const initiateTrade = async (): Promise<void[]> => {
    const tokenList = await findTokensByStatus("readyForTrading");
    if (tokenList.length === 0) {
        Promise.resolve();
    }

    //Immediately mark the purchased as locked for further trading so it cannot be imported again
    await Promise.all(
        tokenList.map((token) => {
            return changeTokenStatus(token.tokenCode, "inTrading");
        })
    );

    return Promise.all(
        tokenList.map(async (token) => {
            const tradingPairs = [];
            const busdPair = token.tokenPairs.filter((tokenPair) => {
                return tokenPair.toLowerCase().includes("busd");
            });
            if (busdPair && busdPair[0]) {
                tradingPairs.push(busdPair[0]);
            }
            const usdtPair = token.tokenPairs.filter((tokenPair) => {
                return tokenPair.toLowerCase().includes("usdt");
            });

            if (usdtPair && usdtPair[0]) {
                tradingPairs.push(usdtPair[0]);
            }

            return sellAvailableTokens(token.tokenCode, tradingPairs);
        })
    );
};

export const moveFundsBackToWallet = async (): Promise<void[]> => {
    const soldTokenList = await findTokensByStatus("soldOnBinance");
    if (soldTokenList.length === 0) {
        return;
    }

    await Promise.all(
        soldTokenList.map(async (token) => {
            return changeTokenStatus(token.tokenCode, "convertingOnBinance");
        })
    );

    return Promise.all(
        soldTokenList.map(async (token) => {
            const exchange = setupBinanceMarket();
            const markets = await exchange.loadMarkets();
            const balances = await exchange.fetchBalance();

            try {
                const availableBusd = balances.free["BUSD"];
                log.info(`Available BUSD: ${availableBusd}`);
                log.info(`Minimum amount for ETH/BUSD pair is ${markets["ETH/BUSD"].limits.amount.min}`);
                const MinimumOrderSize = markets["ETH/BUSD"].limits.amount.min;
                const BusdEthPrice = (await exchange.fetchTicker("ETH/BUSD")).bid;
                const BusdEthAmount = (availableBusd / BusdEthPrice / 100) * 99.8;
                if (MinimumOrderSize > BusdEthAmount) {
                    log.debug("Not enough BUSD available to purchase ETH");
                } else {
                    log.info(`Ethereum price: ${BusdEthPrice}, attempting to buy ${BusdEthAmount} ETH`);
                    const BustSwapForEthOrder = await exchange.createMarketOrder("ETH/BUSD", "buy", BusdEthAmount);
                    log.debug(BustSwapForEthOrder);
                }
            } catch (error) {
                log.error(error);
            }

            try {
                const availableUsdt = balances.free["USDT"];
                log.info(`Available USDT: ${availableUsdt}`);
                log.info(`Minimum amount for ETH/USDT pair is ${markets["ETH/USDT"].limits.amount.min}`);
                const MinimumOrderSize = markets["ETH/USDT"].limits.amount.min;
                const UsdtEthPrice = (await exchange.fetchTicker("ETH/USDT")).bid;
                const UsdtEthAmount = (availableUsdt / UsdtEthPrice / 100) * 99.8;
                if (MinimumOrderSize > UsdtEthAmount) {
                    log.debug("Not enough USDT available to purchase ETH");
                } else {
                    log.info(`Ethereum price: ${UsdtEthAmount}, attempting to buy ${UsdtEthAmount} ETH`);
                    const UsdtSwapForEthOrder = await exchange.createMarketOrder("ETH/USDT", "buy", UsdtEthAmount);
                    log.debug(UsdtSwapForEthOrder);
                }
            } catch (error) {
                log.error(error);
            }

            await changeTokenStatus(token.tokenCode, "convertedOnBinance");

            const EthBalances = await exchange.fetchBalance();
            const availableEth = EthBalances.free["ETH"];
            log.info(`Available ETH: ${availableEth}`);
            log.info(`Eth balance available: ${availableEth}`);
            if (MY_ETHEREUM_ADDRESS) {
                log.info(`Waiting 70 seconds to withdraw`);
                await sleep(70000);
                log.debug("Withdrawing...");
                try {
                    const withdrawOrder = await exchange.withdraw("ETH", availableEth, MY_ETHEREUM_ADDRESS);
                    log.debug(withdrawOrder);
                } catch (error) {
                    log.error(error);
                }
            }

            await changeTokenStatus(token.tokenCode, "withdrawnFromBinance");
        })
    );
};

//watch stream for random period beteween 1.1 and 1.2 seconds
//get highest price from this period
const sellAvailableTokens = async (tokenCode: string, tradingPairs: string[]): Promise<void> => {
    log.debug(tokenCode);
    log.debug(tradingPairs);
    const exchange = setupBinanceMarket();
    await exchange.loadMarkets();
    let timeToSell: number;
    const pricesPerPair = {};

    let sold = false;
    let sellLock = false;
    let firstTrade = true;
    let marketsPromise;

    const balances = await exchange.fetchBalance();

    const availableBalanceToSell = balances.free[tokenCode];

    log.debug(`Available for sale: ${availableBalanceToSell}`);

    log.debug("Measuring server latency...");
    const serverTimeDrift = await calculateServertimeDrift();
    log.debug(serverTimeDrift);
    log.debug(`Waiting for events from Binance Websocket...`);
    let priceLog = "";
    await Promise.all(
        tradingPairs.map((tradingPair) =>
            (async () => {
                while (!sold && !sellLock) {
                    try {
                        // log.debug(`Trading pair to execute against is: ${tradingPair}`);
                        const newTrades = await exchange.watchTrades(tradingPair);
                        newTrades.forEach(async (trade) => {
                            if (!pricesPerPair[tradingPair]) {
                                pricesPerPair[tradingPair] = [];
                            }
                            if (sellLock) {
                                return;
                            }
                            if (!trade?.price || !trade?.timestamp) {
                                return;
                            }
                            if (!timeToSell) {
                                timeToSell = calculateTimeToSell(trade.timestamp, serverTimeDrift);
                            }
                            if (firstTrade) {
                                firstTrade = false;
                                marketsPromise = exchange.loadMarkets(true);
                            }

                            pricesPerPair[tradingPair].push(trade.price);
                            priceLog += `New price price for ${tradingPair}: ${trade.price}\n`;

                            if (trade.timestamp >= timeToSell) {
                                if (sold || sellLock) {
                                    return;
                                }
                                sellLock = true;
                                log.debug(`Initiating sale of ${tokenCode}`);

                                let highestPriceOfAll = 0;
                                let tradingPairWithHighestPrice;

                                for (const pair in pricesPerPair) {
                                    const uniquePairPrices = [...new Set(pricesPerPair[pair])];
                                    const currentHighestPrice = uniquePairPrices
                                        .sort((a: number, b: number) => b - a)
                                        .splice(
                                            uniquePairPrices.length > AMOUNT_OF_TOP_PRICES_TO_DISCARD
                                                ? AMOUNT_OF_TOP_PRICES_TO_DISCARD
                                                : 0
                                        )[0] as number;
                                    if (highestPriceOfAll < currentHighestPrice) {
                                        highestPriceOfAll = currentHighestPrice;
                                        tradingPairWithHighestPrice = pair;
                                    }
                                    if (!currentHighestPrice) {
                                        console.warn(`${uniquePairPrices}`);
                                        throw new Error(`currentHighestPrice is invalid, ${currentHighestPrice}`);
                                    }
                                    log.info(`Highest price on ${pair} was ${currentHighestPrice}`);
                                }

                                log.info(
                                    `Highest price of all was ${highestPriceOfAll} on ${tradingPairWithHighestPrice}`
                                );

                                await changeTokenStatus(tokenCode, "sellingInProgress");
                                await marketsPromise;
                                log.warn("markets loaded");
                                await sellItAll(
                                    exchange,
                                    tradingPairWithHighestPrice,
                                    availableBalanceToSell,
                                    highestPriceOfAll,
                                    tokenCode
                                );
                                await changeTokenStatus(tokenCode, "soldOnBinance");
                                log.debug(`Sale of ${tokenCode} complete`);
                                log.info(priceLog);
                                sold = true;
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

    log.debug("Sale process complete");
    return Promise.resolve();
};

const sellItAll = async (exchange: ccxt.binance, tokenPair, amount, price, tokenCode): Promise<boolean> => {
    log.debug(`Limit Sell order arguments:`);
    log.debug({ tokenPair, amount, price });
    //set a  limit order for the current highest price
    let limitOrder;
    try {
        limitOrder = await exchange.createLimitOrder(tokenPair, "sell", amount, 74);
    } catch (error) {
        console.error(error.code);
        if (error && error.code && error.code && error.code !== -1013) {
            throw new Error(error);
        }
        log.warn("Not enough balance to execute limit order");
    }
    await sleep(TIME_TO_LEAVE_LIMIT_ORDER_ACTIVE);
    log.debug(`Limit Sell order:`);
    log.debug(limitOrder);
    // If we still have unsold tokens, cancel limit order and market sell
    try {
        if (limitOrder?.remaining > 0) {
            await exchange.cancelOrder(limitOrder.id, tokenPair);
            const marketSellOrder = await exchange.createMarketOrder(tokenPair, "sell", limitOrder.remaining);
            await sleep(100);
            log.debug(`Market Sell order:`);
            log.debug(marketSellOrder);
            if (marketSellOrder.status === "closed") {
                return true;
            }
            throw new Error("Market Sell order not in correct state");
        }
        await exchange.createMarketOrder(tokenPair, "sell", limitOrder.remaining);
        return true;
    } catch (error) {
        const markets = await exchange.loadMarkets();
        const minimumTradeableToken = markets[tokenPair]?.limits?.amount?.min;
        const balances = await exchange.fetchBalance();
        const availableBalance = balances.free[tokenCode];

        log.warn(`Available: ${availableBalance} , minimum: ${minimumTradeableToken}`);
        log.trace(error);
    }
};

//determine how long to wait before selling
const calculateTimeToSell = (firstTradeTimestamp, driftData): number => {
    const { latency } = driftData;
    const timeToSell = firstTradeTimestamp + TIME_TO_WAIT_BEFORE_SELLING - latency;
    return timeToSell;
};
