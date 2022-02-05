import { isBefore } from "date-fns";
import { loadToken } from "../coin-analysis/coin-analysis.service";
import { Logger } from "tslog";
import { BigNumber } from "@0x/utils";

const log: Logger = new Logger();

export const getPriceForTokenAtDiscoveryTime = async (tokenName: string): Promise<BigNumber> => {
    const tokenDetailData = await loadToken(tokenName);

    if (isBefore(tokenDetailData.priceTimestamp, tokenDetailData.publishDate)) {
        log.debug(`Historic price in eth from current price: ${tokenDetailData.priceInWei}`);
        return tokenDetailData.priceInWei;
    }

    throw new Error(
        `Price for ${tokenName} was published after the discovery, and thus is probably skewed. Too risky to buy!`
    );
};
