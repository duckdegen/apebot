import dotenv from "dotenv";
dotenv.config();

import { crawlEndpoints } from "./apicrawler/apicrawler.controller";
import { Logger } from "tslog";

const log: Logger = new Logger();

import { promisify } from "util";

const sleep = promisify(setTimeout);

(async () => {
    log.info("Binance announcement total logger started...");
    while (true) {
        await crawlEndpoints();
        await sleep(6000);
    }
})();
