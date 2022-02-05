import { getCoinEntry, getTokenDetails } from "../apis/coinGecko";

import { Logger } from "tslog";
import { findUnprocessedAnnouncements, markAnnouncementAsProcessed } from "../announcements/announcements.service";
import { saveToken, updateToken, loadToken, CoinUpdateDTO } from "./coin-analysis.service";
import { LeanDocument } from "mongoose";
import { TokenDetails } from "./schemas/token-details.schema";
import { fromTokenUnitAmount } from "@0x/utils";

const log: Logger = new Logger();

export const analyzeTokens = async (): Promise<void | (void | LeanDocument<TokenDetails>)[]> => {
    const unprocessedAnnouncements = await findUnprocessedAnnouncements();
    if (unprocessedAnnouncements && unprocessedAnnouncements.length) {
        log.debug(`unprocessedAnnouncements: ${JSON.stringify(unprocessedAnnouncements)}`);
        return Promise.all(
            unprocessedAnnouncements.map(async (document) => {
                try {
                    if (document.state === "processed") {
                        return Promise.resolve();
                    }
                    await markAnnouncementAsProcessed(document._id);

                    //Prioritize search by name first. This is because some tokens are ambiguous, like "lina", which when searched yields some vietnamese shitcoin and not what was launched on Binance.
                    let coinEntry = await getCoinEntry(
                        document.tokenCommonName ? document.tokenCommonName : document.tokenCode,
                        document.tokenCommonName ? "name" : "symbol"
                    );
                    if (!coinEntry) {
                        log.error(`Could not find token info by name ${document.tokenCommonName} on coingecko`);
                        coinEntry = await getCoinEntry(document.tokenCode, "symbol");
                        // If this fails because we looked up by name, try by symbol instead. This is useful in cases like "Binance will list Axie Infinity's Small Love Potion (SLP) in the Innovation Zone", as that common name is incorrect.
                        if (!coinEntry) {
                            log.error(`Could not find token info by symbol ${document.tokenCode} on coingecko`);
                            return Promise.resolve();
                        }
                    }
                    const tokenDetails = await getTokenDetails(coinEntry.id);

                    if (tokenDetails.platformId !== "ethereum") {
                        log.debug(`Token not on ethereum chain, on ${tokenDetails.platformId} instead`);
                        return Promise.resolve();
                    }

                    log.info(
                        `Announcement discovered for ${coinEntry.id} ($${coinEntry.symbol}) now! 1 Eth should yield ± ${
                            1 / tokenDetails.marketData.current_price.eth
                        } tokens`
                    );

                    const existingTokenDetailDocument = await loadToken(coinEntry.symbol);

                    if (existingTokenDetailDocument) {
                        const updatePayload = {} as CoinUpdateDTO;

                        if (!existingTokenDetailDocument.tokenPairs && document.tokenPairs) {
                            updatePayload.tokenPairs = document.tokenPairs;
                        }

                        if (!existingTokenDetailDocument.tradingStartDate && document.tradingStartDate) {
                            updatePayload.tradingStartDate = document.tradingStartDate;
                        }

                        return updateToken(coinEntry.symbol, updatePayload);
                    }

                    return saveToken({
                        tokenCode: coinEntry.symbol,
                        tokenContract: tokenDetails.contractAddress,
                        publishDate: document.publishDate,
                        tokenPairs: document.tokenPairs,
                        priceInWei: fromTokenUnitAmount(tokenDetails.marketData.current_price.eth),
                        priceTimestamp: new Date(tokenDetails.marketData.last_updated),
                        tradingStartDate: document.tradingStartDate,
                        purchased: false,
                    });
                } catch (error) {
                    log.error(error);
                }
            })
        );
    }
    return Promise.resolve();
};
