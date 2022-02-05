import { Logger } from "tslog";
import * as chrono from "chrono-node";

const log: Logger = new Logger();

// Binance will then list DODO into the innovation zone at 2021-02-19 10:00 AM (UTC) and open trading with DODO/BTC, DODO/BUSD and DODO/USDT trading pairs.
// Binance will then list BTCST into the innovation zone at 2021/01/13 6:00 AM (UTC) and open trading with BTCST/BTC, BTCST/BUSD and BTCST/USDT trading pairs.
// Binance will list Nervos Network (CKB) and open trading for CKB/BTC, CKB/BUSD and CKB/USDT trading pairs at 2021-01-26 12:00 PM (UTC). Users can now start depositing CKB in preparation for trading.
// Binance will list Prosper (PROS) in the Innovation Zone and will open trading for a PROS/ETH trading pair at 2021-02-03 8:00 AM (UTC). Users can now start depositing PROS in preparation for trading.
// Binance will list Frax Share (FXS) in the Innovation Zone and will open trading for FXS/BTC and FXS/BUSD trading pairs at 2021-02-18 9:00 AM (UTC). Users can now start depositing FXS in preparation for trading.
// Binance will list DeXe (DEXE) in the Innovation Zone and will open trading for DEXE/ETH and DEXE/BUSD trading pairs at 2021-01-21 8:00 AM (UTC). Users can now start depositing DEXE in preparation for trading.
// Binance will list Trust Wallet Token (TWT) in the Innovation Zone and will open trading for TWT/BTC, TWT/BUSD and TWT/USDT trading pairs at 2021-01-27 8:00 AM (UTC). Users can now start depositing TWT in preparation for trading.

const LineBegin = "Binance will then list";
const LineBegin2 = "Binance will list";
const lineStartsInTheRightWay = (inputLine: string) => {
    if (inputLine.toLowerCase().includes(LineBegin.toLowerCase())) {
        return true;
    }
    if (inputLine.toLowerCase().includes(LineBegin2.toLowerCase())) {
        return true;
    }

    return false;
};

const openTrading = "open trading";
const lineMentionsOpeningTrading = (inputLine: string) => {
    if (inputLine.toLowerCase().includes(openTrading.toLowerCase())) {
        return true;
    }

    return false;
};

const utcString = "(UTC)";
const lineContainsUTC = (inputLine: string) => {
    if (inputLine.toLowerCase().includes(utcString.toLowerCase())) {
        return true;
    }

    return false;
};

const BUSD = "/BUSD";
const USDT = "/USDT";
const lineContainsGoodTradingPairs = (inputLine: string) => {
    if (inputLine.toLowerCase().includes(BUSD.toLowerCase())) {
        return true;
    }
    if (inputLine.toLowerCase().includes(USDT.toLowerCase())) {
        return true;
    }

    return false;
};

const lineContainsNoStockMention = (inputLine: string) => {
    if (inputLine.toLowerCase().includes("Stock Token".toLowerCase())) {
        return false;
    }
    return true;
};

const containsStablecoinMention = (inputLine: string) => {
    if (inputLine.toLowerCase().includes("stablecoin")) {
        return true;
    }
    return false;
};

export const extractTokenCode = (tokenPair: string): string => {
    const tokenCode = tokenPair.trim().split("/")[0];

    if (tokenCode && tokenCode.length > 0) {
        return tokenCode;
    }

    log.error("No token code could be found in text");
    return "";
};

export const getProcessedListingText = (inputText: string): string => {
    const announcementLines = inputText
        .split(".")
        .filter(lineStartsInTheRightWay)
        .filter(lineContainsNoStockMention)
        .filter(lineMentionsOpeningTrading)
        .filter(lineContainsUTC)
        .filter(lineContainsGoodTradingPairs);

    const mentionsStablecoin = containsStablecoinMention(inputText);

    if (mentionsStablecoin) {
        log.warn("stablecoin mentioned. discarding listing");
        log.warn(inputText);
        return;
    }

    log.info("announcementLines");
    log.debug(announcementLines);

    if (announcementLines && announcementLines.length && announcementLines.length === 1) {
        log.debug("returning new announcement line: " + announcementLines[0]);
        return announcementLines[0];
    }

    if (announcementLines && announcementLines.length && announcementLines.length > 1) {
        log.error("more than one target line found in announcement text. What's going on?");
        log.debug(inputText);
        log.debug(announcementLines.length);
    }

    if (!announcementLines) {
        log.error("No listing lines found....");
        log.info(inputText);
    }

    return;
};

export const findTokenPairsInText = (inputText: string): string[] => {
    const tokenFinderRegex = new RegExp(/\w+\/(?:USDT|BUSD|BNB|BTC)/g);

    const tokenPairList = [];
    let result;
    while ((result = tokenFinderRegex.exec(inputText)) !== null) {
        tokenPairList.push(result);
    }
    return [].concat(...tokenPairList);
};

export const findTokenCommonNameInText = (inputText: string): string => {
    const tokenCommonNameRegex = new RegExp(/(?<=list )(?:[^_][\w.]+)+/g);
    const matches = tokenCommonNameRegex.exec(inputText);

    if (matches && matches.length && matches[0]) {
        return matches[0];
    }

    return;
};

export const findTradingStartDate = (inputText: string): string => {
    const TradingStartRegex = new RegExp(/2021(.*(\(UTC\)))/g);

    const matches = TradingStartRegex.exec(inputText);

    if (matches && matches.length && matches[0]) {
        const dateObject = chrono.parseDate(matches[0]);
        return dateObject.toISOString();
    }

    return;
};
