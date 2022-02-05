import { BigNumber } from "@0x/utils";
import { Logger } from "tslog";
import { getPriceForTokenAtDiscoveryTime } from "./riskmanagement.service";

const KELLY_FACTOR = +process.env.KELLY_FACTOR || 1;

const log: Logger = new Logger();

export const calculateSpendableAmount = (currentAssets: BigNumber): BigNumber => {
    const P = 70; // Probability Asset Outperforms (Percent)
    const G = 180; // Expected Gain When It Outperforms (Percent)
    const L = 30; // Expected Loss When It Underperforms (Percent)
    const KT = KELLY_FACTOR; // Type of Kelly - '1' for full, '.5' for Half, '.25' for Quarter... etc.

    // Calculate values
    const KN = ((P / 100) * G - ((100 - P) / 100) * L) / G; // Kelly Number (Percent of Bankroll)
    const KNA = KN * KT; // Adjusted Kelly Number for Kelly Type (Percent of Bankroll)
    const amount = new BigNumber(currentAssets.multipliedBy(KNA).toFixed(0)); // Wei we can spend safely

    return amount;
};

export const isItAGoodDeal = async (quotedPriceInWei: BigNumber, tokenName: string): Promise<boolean> => {
    const priceInWei = await getPriceForTokenAtDiscoveryTime(tokenName);
    const increase = quotedPriceInWei.minus(priceInWei);
    const percentageDifference = increase.dividedBy(priceInWei).times(100);

    const data = {
        quotedPriceInWei,
        priceInWei,
        increase,
        percentageDifference,
    };
    log.debug(data);
    log.debug(`Price percent difference is: ${percentageDifference.toFormat(1)}%`);
    if (percentageDifference.isLessThan(15)) {
        return true;
    }
    return false;
};
