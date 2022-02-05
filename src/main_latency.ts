import { Logger } from "tslog";
import { calculateServertimeDrift } from "./timesync/timesync.controller";

const log: Logger = new Logger();

(async function () {
    log.debug("Measuring server latency...");
    const serverTimeDrift = await calculateServertimeDrift();
    log.debug(serverTimeDrift);
})();
