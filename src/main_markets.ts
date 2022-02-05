import dotenv from "dotenv";
dotenv.config();
import { Logger } from "tslog";
import ccxt from "ccxt.pro";

const { BINANCE_API_KEY, BINANCE_API_SECRETKEY } = process.env;

const log: Logger = new Logger();
const exchangeClass = ccxt["binance"];

const setupBinanceMarket = (): ccxt.binance => {
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

(async function () {
    log.debug("Connecting to markets...");
    const exchange = setupBinanceMarket();
    const markets = await exchange.loadMarkets();
    log.debug(markets["TKO/BTC"]);
})();
