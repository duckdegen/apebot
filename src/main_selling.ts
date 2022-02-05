import dotenv from "dotenv";
dotenv.config();
import connect from "./mongo";
import {
    processPurchasedTokens,
    checkIfBalanceIsAvailable,
    initiateTrade,
    moveFundsBackToWallet,
    moveOwnedTokensToBinance,
    waitForTradingStartDate,
} from "./trading/trading.controller";
import { Logger } from "tslog";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();
const mongo_connection_string = process.env.MONGO_CONNECTION_STRING || "";

(async function () {
    await connect(mongo_connection_string);
})();

log.info("Seller worker executed");

(async () => {
    log.info("Seller worker started...");
    while (true) {
        await processPurchasedTokens();
        // log.warn("processPurchasedTokens complete");
        await moveOwnedTokensToBinance();
        // log.warn("moveOwnedTokensToBinance complete");
        await checkIfBalanceIsAvailable();
        // log.warn("checkIfBalanceIsAvailable complete");
        await waitForTradingStartDate();
        // log.warn("waitForTradingStartDate complete");
        await initiateTrade();
        // log.warn("initiateTrade complete");
        await moveFundsBackToWallet();
        // log.warn("moveFundsBackToWallet complete");
        // log.info("processed sales");
        await sleep(10000);
    }
})();
