import { Logger } from "tslog";
import { notifyHumans } from "./purchasing/purchasing.controller";

const log: Logger = new Logger();

(async function () {
    log.debug("Testing twilio...");
    await notifyHumans(
        { transactionHash: "0xa25c08bb15cf0f049e1a0440bf40dae397f49d535cb63212bbfa1b66fb5a9603" },
        { tokenCode: "MIR" }
    );
})();
