import add from "date-fns/add";
import { Logger } from "tslog";

const log: Logger = new Logger();
/* eslint-disable @typescript-eslint/no-namespace */
export type CachedEndpoint = {
    url: string;
    predictedTimeUncached: number;
    cacheHit: boolean;
};

export type UpdateCachedEndpointDTO = {
    url: string;
    age: number;
    cacheHit: boolean;
};

export namespace CacheBusterInstance {
    let currentUrlPermutations = [] as CachedEndpoint[];
    let measuredCacheDuration = 0;

    export const setPermutedUrls = (permutedUrls: string[]): void => {
        currentUrlPermutations = permutedUrls.map((url) => {
            return {
                url: url,
                predictedTimeUncached: 0,
                cacheHit: false,
            };
        });
    };

    export const getPermutedUrls = (): CachedEndpoint[] => {
        return JSON.parse(JSON.stringify(currentUrlPermutations)); //Return a copy of the data
    };

    export const updateCachedEndpointAfterUse = (dto: UpdateCachedEndpointDTO): void => {
        const isUrl = (urlPermutation) => urlPermutation.url === dto.url;
        const index = currentUrlPermutations.findIndex(isUrl);

        currentUrlPermutations[index].cacheHit = true;
        // log.debug(
        //     `setting url to become available again in ${measuredCacheDuration - (dto.cacheHit ? dto.age : 0)} seconds`
        // );
        // log.debug(`measured cache duration: ${measuredCacheDuration}`);
        // log.debug(`cache hit: ${dto.cacheHit}`);
        // log.debug(`cache age: ${dto.age}`);
        currentUrlPermutations[index].predictedTimeUncached = add(new Date(), {
            seconds: measuredCacheDuration - (dto.cacheHit ? dto.age : 0),
        }).valueOf();

        const now = new Date().valueOf();

        if (
            currentUrlPermutations[index].predictedTimeUncached !== 0 &&
            currentUrlPermutations[index].predictedTimeUncached < now
        ) {
            log.warn("Timestamp is not in the future!");
        }
    };

    export const getUncachedEndpoint = (): CachedEndpoint | void => {
        const now = new Date().valueOf();

        // log.info(`Now is ${now}`);
        currentUrlPermutations = currentUrlPermutations.map((urlItem) => {
            if (urlItem.predictedTimeUncached !== 0 && urlItem.predictedTimeUncached < now) {
                // log.debug("Making url available again");
                return {
                    predictedTimeUncached: 0,
                    cacheHit: false,
                    url: urlItem.url,
                };
            }
            return urlItem;
        });

        const availableUrls = currentUrlPermutations.filter((urlItem) => {
            return urlItem.cacheHit === false;
        });

        const randomIndex = Math.floor(Math.random() * availableUrls.length);
        // log.debug(`There are currently ${availableUrls.length} uncached urls left`);
        if (availableUrls.length) {
            return availableUrls[randomIndex];
        }
    };

    export const setCacheDuration = (duration: number): void => {
        log.debug(`Setting cache duration to: ${duration}`);
        measuredCacheDuration = duration;
    };

    export const getCacheDuration = (): number => {
        return measuredCacheDuration;
    };
}
