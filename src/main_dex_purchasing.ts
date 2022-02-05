import dotenv from "dotenv";
dotenv.config();
import connect from "./mongo";
import { processNewAnnouncements } from "./announcements/announcements.controller";
import { analyzeTokens } from "./coin-analysis/coin-analysis.controller";
import { buyAllTheTokens } from "./purchasing/purchasing.controller";
import { Logger } from "tslog";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();
const mongo_connection_string = process.env.MONGO_CONNECTION_STRING || "";

(async function () {
    await connect(mongo_connection_string);
})();

(async () => {
    log.info("Dex worker started...");
    while (true) {
        await Promise.all([processNewAnnouncements(), analyzeTokens(), buyAllTheTokens()]);
        // log.info("processed dex purchases...");
        await sleep(200);
    }
})();
