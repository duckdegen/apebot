import {
    fetchAnnouncementDetailsFromAPI,
    findAnnouncementByUrl,
    getAnnouncementsFromAPI,
    getNewAnnouncements,
    markAnnouncementAsDOA,
    parseAnnouncementDetailData,
    persistNewAnnouncement,
    persistNewArbitrage,
    persistValidAnnouncement,
} from "./announcements.service";
import {
    getProcessedListingText,
    findTokenCommonNameInText,
    findTokenPairsInText,
    findTradingStartDate,
} from "./text-analysis.service";

import { Logger } from "tslog";
import { Announcement } from "./schemas/announcement.schema";
import { Article } from "./interfaces/announcement-api.interface";

const log: Logger = new Logger();

// const categoryType = +process.env.BINANCE_CMS_CATEGORY_TYPE || "48";

export const findNewAnnouncements = async (binanceAnnouncmentURL: string): Promise<Announcement[] | void> => {
    const announcementData = await getAnnouncementsFromAPI(binanceAnnouncmentURL);

    if (announcementData && announcementData.success && announcementData.data?.catalogs.length) {
        return Promise.all(
            (
                await announcementData.data.catalogs
                    .map((catalog) => {
                        const announcements: Article[] = [];
                        //Check if we are retrieving the correct article category. 48 is new listings
                        // if (catalog.catalogId === categoryType) {
                        return announcements.concat(catalog.articles);
                        // }
                        // return [];
                    })
                    .flat()
                    // .map(async (announcementData) => {
                    //     await sleep(1000);
                    //     const announcementDataDetail = await fetchAnnouncementDetailsFromAPI(announcementData.code);
                    //     // If we got no data because we got an error from the API or it is already persisted, return an empty payload so we can filter it out
                    //     if (!announcementDataDetail || !announcementDataDetail.code) {
                    //         return {
                    //             url: "",
                    //             title: "",
                    //             textContent: "",
                    //             publishDate: 0,
                    //         };
                    //     }
                    //     // Return the actual data
                    //     return {
                    //         url: announcementData.code,
                    //         title: announcementData.title,
                    //         textContent: parseAnnouncementDetailData(announcementDataDetail.data.body),
                    //         publishDate: announcementData.releaseDate,
                    //     };
                    // })
                    //reduce example:
                    .reduce(
                        async (p, announcementData) =>
                            p.then((all) => {
                                return fetchAnnouncementDetailsFromAPI(announcementData.code).then(async (result) => {
                                    let returnValue;
                                    if (!result || !result.code) {
                                        returnValue = {
                                            url: "",
                                            title: "",
                                            textContent: "",
                                            publishDate: 0,
                                        };
                                    } else {
                                        // Return the actual data
                                        returnValue = {
                                            url: announcementData.code,
                                            title: announcementData.title,
                                            textContent: parseAnnouncementDetailData(result.data.body),
                                            publishDate: announcementData.releaseDate,
                                        };
                                    }

                                    return all.concat([returnValue]);
                                });
                            }),
                        Promise.resolve([])
                    )
            ).map(async (announcement) => {
                const announcementData = await announcement;
                if (announcementData?.url !== "") {
                    const announcementFound = await findAnnouncementByUrl(announcementData.url);
                    if (!announcementFound) {
                        log.debug(`Persisting announcement with the following title: ${announcementData.title}`);
                        return persistNewAnnouncement(announcementData);
                    }
                }
                return;
            })
        );
    }
    return Promise.resolve();
};

export const processNewAnnouncements = async (): Promise<void | void[]> => {
    const newAnnouncements = await getNewAnnouncements();
    // log.debug(`${newAnnouncements.length} new announcements found`);
    if (newAnnouncements.length) {
        log.debug(`New Announcements detected for processing: ${JSON.stringify(newAnnouncements)}`);
        return Promise.all(
            newAnnouncements.map(async (announcement) => {
                try {
                    const { textContent, url } = announcement;
                    const newListingText = getProcessedListingText(textContent);
                    log.debug("got a new listing...");
                    log.debug(newListingText);
                    if (!newListingText) {
                        // The Announcement contains no actionable token. Mark it as dead on arrival and move on.
                        await markAnnouncementAsDOA(url);
                        log.debug(`Had no listing text. Marked as DOA.`);
                        return Promise.resolve();
                    }
                    log.debug(`New listing text: ${newListingText}`);
                    const tokenPairs = findTokenPairsInText(newListingText);
                    const tradingStartDate = findTradingStartDate(newListingText);
                    const tokenCommonName = findTokenCommonNameInText(newListingText);
                    log.debug(`tokenPairs: ${tokenPairs}`);
                    log.debug(`tradingStartDate: ${tradingStartDate}`);
                    log.debug(`tokenCommonName: ${tokenCommonName}`);
                    let expired = false;
                    if (new Date() > new Date(tradingStartDate)) {
                        expired = true;
                    }
                    const payload = {
                        url,
                        content: textContent,
                        newListingText,
                        expired,
                        tokenPairs,
                        tradingStartDate,
                        tokenCommonName,
                    };
                    log.debug("about to persist valid announcement");
                    const validAnnouncementPromise = await persistValidAnnouncement(payload);

                    await persistNewArbitrage({
                        tokenPairs: tokenPairs,
                        tradingStartDate: tradingStartDate,
                        tokenCode: tokenPairs[0].split("/")[0],
                    });
                    log.debug(`validAnnouncementPromise resolved: ${JSON.stringify(validAnnouncementPromise)}`);
                } catch (error) {
                    log.debug(announcement);
                    log.trace(error);
                }

                return Promise.resolve();
            })
        );
    }

    return Promise.resolve();
};
