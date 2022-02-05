import AnnouncementSchema, { Announcement } from "./schemas/announcement.schema";
import ArbitrageSchema, { Arbitrage } from "./schemas/arbitrage.schema";
import { extractTokenCode } from "./text-analysis.service";
import got from "got";
import { HttpsProxyAgent } from "hpagent";
import type { AnnouncementAPI } from "./interfaces/announcement-api.interface";
import type { AnnouncementDetailAPI } from "./interfaces/announcement-detail-api.interface";
import { NewAnnouncementDTO } from "./dto/new-announcement.dto";
import { processRequestHeaders } from "../cachebuster/cachebuster.controller";
import { Logger } from "tslog";
import { LeanDocument } from "mongoose";
import { PublicMarketChild, PublicMarketNotice } from "./interfaces/public-market-notice.interface";
import he from "he";
import { NewArbitrageDTO } from "./dto/new-arbitrage.dto";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();

export const getAnnouncementsFromAPI = async (urlToCrawl: string): Promise<AnnouncementAPI> => {
    let newEndpoint;
    let responseData;
    try {
        do {
            log.debug(`Fetching announcement data from ${urlToCrawl}`);
            const promise = got.get(urlToCrawl, {
                agent: {
                    https: new HttpsProxyAgent({
                        keepAlive: true,
                        keepAliveMsecs: 1000,
                        maxSockets: 256,
                        maxFreeSockets: 256,
                        scheduling: "lifo",
                        proxy: "http://jp.proxymesh.com:31280",
                    }),
                },
            });
            const promiseData = await promise;
            if (promiseData.statusCode === 400) {
                log.error("API returned 400 error");
                log.error(promiseData);
                Promise.resolve();
            }
            const { headers } = promiseData;
            const data = await promise.json<AnnouncementAPI>();
            const headerPayload = {
                headers: {
                    age: headers.age ? +headers.age : undefined,
                    cacheHeader: headers["x-cache"] as string,
                },
                url: urlToCrawl,
            };
            log.debug(`Header payload: ${JSON.stringify(headerPayload)}`);
            newEndpoint = processRequestHeaders(headerPayload);
            if (!newEndpoint) {
                log.debug("Endpoint was successfully accessed directly without cache");
                responseData = data;
            } else {
                log.warn(
                    `Endpoint got detected as cached. Assigning new endpoint for retry: ${JSON.stringify(newEndpoint)}`
                );
                urlToCrawl = newEndpoint.url;
            }
        } while (newEndpoint);
    } catch (error) {
        log.trace(error);
    }

    log.debug(`Fetching completed.`);
    return Promise.resolve(responseData);
};

export const fetchAnnouncementDetailsFromAPI = async (
    announcementId: string
): Promise<AnnouncementDetailAPI | void> => {
    if (!announcementId) {
        log.error("No announcment ID passed to announcement retreiver");
        log.error(announcementId);
        Promise.resolve();
    }

    let responseData;
    const urlToCrawl = `https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=${announcementId}`;
    try {
        // If we have the announcement in our DB already, ignore.
        const announcementFound = await findAnnouncementByUrl(announcementId);
        if (announcementFound) {
            return Promise.resolve();
        }

        // Retrieve announcement from API
        log.debug(`Fetching announcement details from ${urlToCrawl}`);
        const promise = got.get(urlToCrawl);
        const promiseData = await promise;

        // Error if we don't get a HTTP success code
        if (promiseData.statusCode !== 200) {
            log.error(`API returned ${promiseData.statusCode} error`);
            log.error(promiseData);
            return Promise.resolve();
        }

        responseData = await promise.json<AnnouncementAPI>();
        await sleep(100);

        log.debug(`Retrieved announcement from API: ${JSON.stringify(responseData)}`);
    } catch (error) {
        log.trace(error);
    }

    log.debug(`Fetching announcement detail from api completed.`);
    return Promise.resolve(responseData);
};

const isPublicMarketNotice = (input: PublicMarketNotice | PublicMarketChild): input is PublicMarketNotice => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (input as any).child !== undefined;
};

const isPublicMarketChild = (input: PublicMarketNotice | PublicMarketChild): input is PublicMarketChild => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (input as any).text !== undefined;
};

export const traverse = (
    node: PublicMarketNotice | PublicMarketChild,
    callback: (node: PublicMarketNotice | PublicMarketChild) => void
): void => {
    callback(node);
    if (isPublicMarketNotice(node)) {
        for (let i = 0; i < node.child.length; i++) {
            const child = node.child[i];
            traverse(child, callback);
        }
    }
};

export const parseAnnouncementDetailData = (detailData: string): string => {
    let text = "";
    log.debug(detailData);

    if (detailData[0] === "<") {
        // we are dealing with HTML
    } else {
        // We are dealing with JSON
        const parsedDetailData = JSON.parse(detailData) as PublicMarketNotice;
        traverse(parsedDetailData, (node: PublicMarketNotice | PublicMarketChild) => {
            if (isPublicMarketChild(node) && !isPublicMarketNotice(node)) {
                text = text + he.decode(node.text);
            }
            return node;
        });
    }

    console.log(text);
    return text;
};

export const persistNewAnnouncement = async (newAnnouncement: NewAnnouncementDTO): Promise<Announcement> => {
    const { url, title, textContent, publishDate } = newAnnouncement;

    return AnnouncementSchema.create({
        url: url,
        title: title,
        textContent: textContent,
        dateFound: new Date(),
        state: "new",
        publishDate: new Date(publishDate),
    });
};

export const persistNewArbitrage = async (newArbitrage: NewArbitrageDTO): Promise<Arbitrage> => {
    const { tokenPairs, tradingStartDate, tokenCode } = newArbitrage;

    return ArbitrageSchema.create({
        tradingStartDate: tradingStartDate,
        tokenPairs: tokenPairs,
        tokenCode: tokenCode,
        state: "waitingForArbitrage",
    });
};

export const getNewAnnouncements = async (): Promise<LeanDocument<Announcement>[]> => {
    return AnnouncementSchema.find({ state: "new" }).lean().exec();
};

export const findUnprocessedAnnouncements = async (): Promise<LeanDocument<Announcement>[]> => {
    return AnnouncementSchema.find({ state: "extracted" }).lean().exec();
};

export const findAnnouncementByUrl = async (url: string): Promise<LeanDocument<Announcement>> => {
    return AnnouncementSchema.findOne({ url: url }).lean().exec();
};

export const markAnnouncementAsProcessed = async (documentId: string): Promise<LeanDocument<Announcement>> => {
    return AnnouncementSchema.findByIdAndUpdate(
        documentId,
        {
            state: "processed",
        },
        { new: true }
    )
        .lean()
        .exec();
};

export const markAnnouncementAsDOA = async (url: string): Promise<LeanDocument<Announcement>> => {
    return AnnouncementSchema.findOneAndUpdate(
        { url: url },
        {
            state: "DOA",
        },
        { new: true }
    )
        .lean()
        .exec();
};

interface ValidAnnouncementDTO {
    url: string;
    content: string;
    newListingText: string;
    expired: boolean;
    tokenPairs: string[];
    tradingStartDate: string;
    tokenCommonName?: string;
}

export const persistValidAnnouncement = async (dto: ValidAnnouncementDTO): Promise<LeanDocument<Announcement>> => {
    const { url, content, newListingText, expired, tokenPairs, tradingStartDate, tokenCommonName } = dto;
    log.debug("Attempting to persist valid announcement");

    const payload = {
        textContent: content,
        newListingText: newListingText,
        state: expired ? "expired" : "extracted",
        tokenPairs: tokenPairs,
        tokenCode: extractTokenCode(tokenPairs[0]),
        tradingStartDate: new Date(tradingStartDate),
        tokenCommonName: tokenCommonName,
    };

    log.debug(payload);

    return AnnouncementSchema.findOneAndUpdate({ url: url }, payload, { new: true }).lean().exec();
};
