import got from "got";
import { promisify } from "util";
import { CacheBusterInstance, CachedEndpoint } from "./cachebuster.namespace";
import { buildQueryParams } from "./cachebuster.service";
import { Logger } from "tslog";

const log: Logger = new Logger();
const sleep = promisify(setTimeout);
export interface CacheBusterDTO {
    pageSize: number[];
    endPointURL: string;
}

export const memoizeBinanceUncacheableUrls = (dto: CacheBusterDTO): void => {
    const currentUrlPermutations = dto.pageSize
        .map((pageSize) => {
            const queryParams = {
                type: 1,
                pageNo: 1,
                pageSize: pageSize,
            };
            return buildQueryParams(queryParams);
        })
        .map((queryString) => {
            return `${dto.endPointURL}?${queryString}`;
        });
    console.log(currentUrlPermutations);
    CacheBusterInstance.setPermutedUrls(currentUrlPermutations);
};

export const measureCacheDuration = async (): Promise<number> => {
    const currentUrlPermutations = CacheBusterInstance.getPermutedUrls();

    if (!currentUrlPermutations && !currentUrlPermutations[0]) {
        throw new Error("Permutated URLs not found");
    }

    let cached = false;
    let cacheAge = 0;
    // Hit endpoint a first time to warm up cache
    await got(currentUrlPermutations[1]);

    // Keep hitting it until we miss. The cache duration can be extracted from cloudfronts 'age' header
    do {
        const { headers } = await got(currentUrlPermutations[1]);
        const cachedHeader = headers["x-cache"];
        if (headers["age"] && typeof headers["age"] === "string") {
            cacheAge = +headers["age"];
        }
        cached = cachedHeader === "Hit from cloudfront";
        await sleep(1000);
        log.info(`cacheAge: ${cacheAge}`);
    } while (cached);

    const cacheDuration = cacheAge + 1; // Plus one because we don't see the last second. But it's there :)

    CacheBusterInstance.setCacheDuration(cacheDuration);
    return cacheDuration;
};

export interface requestHeadersDTO {
    headers: {
        age: number;
        cacheHeader: string;
    };
    url: string;
}

export const getUncachedEndpoint = (): CachedEndpoint | void => {
    return CacheBusterInstance.getUncachedEndpoint();
};

export const processRequestHeaders = (dto: requestHeadersDTO): CachedEndpoint | void => {
    if (dto.headers.cacheHeader === "Hit from cloudfront" && dto.headers.age && typeof dto.headers.age === "number") {
        log.debug(`Marking ${dto.url} as cached for the next period of cache duration`);
        CacheBusterInstance.updateCachedEndpointAfterUse({
            url: dto.url,
            age: dto.headers.age,
            cacheHit: true,
        });

        return CacheBusterInstance.getUncachedEndpoint();
    }

    // log.debug(`Previously uncached endpoint ${dto.url}, marking as cached for the next period of cache duration`);

    CacheBusterInstance.updateCachedEndpointAfterUse({
        url: dto.url,
        age: dto.headers.age,
        cacheHit: false,
    });

    return;
};
