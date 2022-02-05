import dotenv from "dotenv";
dotenv.config();
import { getFees } from "./mempool/mempool.controller";
import { Logger } from "tslog";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();

(async () => {
    log.info("Mempool worker started...");
    while (true) {
        log.debug(await getFees());
        await sleep(10000);
    }
})();
