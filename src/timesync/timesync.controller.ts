import * as stat from "./timesync.utils";
import { Logger } from "tslog";
import got from "got";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const log: Logger = new Logger();
const URL = "https://api.binance.com";

interface Offset {
    roundtrip: number;
    offset: number;
}

export interface SynchronizationData {
    offset: number;
    latency: number;
}

export const calculateServertimeDrift = async (): Promise<SynchronizationData> => {
    const offsets = [] as Offset[];
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        const offset = await calculateOffset();
        offsets.push(offset);
    }

    // filter out null results
    const results = offsets.filter((result) => result !== null);

    // calculate the limit for outliers
    const roundtrips = results.map((result) => result.roundtrip);
    const limit = stat.median(roundtrips) + stat.std(roundtrips);

    log.silly(`latency median: ${stat.median(roundtrips)}`);
    log.silly(`latency standard deviation: ${stat.std(roundtrips)}`);
    log.silly(`latency limit: ${limit}`);
    // filter all results which have a roundtrip smaller than the mean+std
    const filtered = results.filter((result) => result.roundtrip < limit);
    const processedOffsets = filtered.map((result) => result.offset);
    const processedLatencies = filtered.map((result) => result.roundtrip / 2);

    // return the new offset
    return filtered.length > 0 ? { offset: stat.mean(processedOffsets), latency: stat.mean(processedLatencies) } : null;
};

interface ServerTime {
    serverTime: number;
}
const getServerTime = async (): Promise<ServerTime> => {
    const url = `${URL}/api/v3/time`;
    return got.get(url, {}).json<ServerTime>();
};

const calculateOffset = async (): Promise<Offset> => {
    // Upon receipt by client, client subtracts current time from sent time and divides by two to compute latency.
    const startTime = new Date().valueOf();

    //FIXME: Handle timeouts of requests
    const { serverTime } = await getServerTime();
    const currentTime = new Date().valueOf();

    const roundtrip = currentTime - startTime;
    const onewayTrip = roundtrip / 2;

    // It subtracts current time from server time to determine client-server time delta and adds in the half-latency to get the correct clock delta.
    const offset = serverTime - currentTime + onewayTrip;

    return { offset, roundtrip };
};
