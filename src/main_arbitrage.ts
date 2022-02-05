import dotenv from "dotenv";
dotenv.config();
import connect from "./mongo";
import { waitForTradingStartDate, initiateTrade } from "./arbitrage/arbitrage.controller";
import { Logger } from "tslog";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();
const mongo_connection_string = process.env.MONGO_CONNECTION_STRING || "";

(async function () {
    await connect(mongo_connection_string);
})();

(async () => {
    log.info("Arbitrager trader started...");
    while (true) {
        await waitForTradingStartDate();
        await initiateTrade();
        await sleep(10000);
    }
})();
