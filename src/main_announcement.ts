import dotenv from "dotenv";
dotenv.config();
import connect from "./mongo";
import { findNewAnnouncements } from "./announcements/announcements.controller";
import { promisify } from "util";
import {
    memoizeBinanceUncacheableUrls,
    measureCacheDuration,
    getUncachedEndpoint,
} from "./cachebuster/cachebuster.controller";
import { Logger } from "tslog";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();
const AnnouncementBaseUrl = process.env.ANNOUNCEMENT_API_BASEURL || "";
const ANNOUNCEMENT_MONITORING_INTERVAL = +process.env.ANNOUNCEMENT_MONITORING_INTERVAL || 2000;
const mongo_connection_string = process.env.MONGO_CONNECTION_STRING || "";

(async () => {
    log.info("Connecting to mongo...");
    await connect(mongo_connection_string);
    log.info("Announcement worker running");
    log.info("Checking AWS Cloudfront cache duration and memoizing urls...");
    memoizeBinanceUncacheableUrls({
        pageSize: [1, 2, 3, 5, 10, 20],
        // pageSize: [1, 2, 3],
        endPointURL: AnnouncementBaseUrl,
    });
    const cacheDuration = await measureCacheDuration();
    log.info(`Cache duration: ${cacheDuration}`);
    while (true) {
        const uncachedEndpointMetadata = getUncachedEndpoint();
        if (uncachedEndpointMetadata) {
            await findNewAnnouncements(uncachedEndpointMetadata.url);
        }
        // log.info("fetched announcements...");
        await sleep(ANNOUNCEMENT_MONITORING_INTERVAL);
    }
})();
