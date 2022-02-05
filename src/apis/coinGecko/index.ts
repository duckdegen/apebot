import { CoinEntry } from "./interfaces/coin-list.interface";
import { CoinDetailsInterface, TokenDetails } from "./interfaces/coin-details.interface";
import got from "got";
import { Logger } from "tslog";

const log: Logger = new Logger();

export const getCoinEntry = async (tokenName: string, matchingAttribute: string): Promise<CoinEntry> => {
    const url = `https://api.coingecko.com/api/v3/coins/list`;
    if (!matchingAttribute) {
        log.error(`No attribute to match againt specified`);
    }
    const body = await got.get(url).json<CoinEntry[]>();
    const matchingToken = body.filter((coinEntry) => {
        if (matchingAttribute === "name") {
            return coinEntry.name.toLowerCase() === tokenName.toLowerCase();
        }

        if (matchingAttribute === "symbol") {
            return coinEntry.symbol.toLowerCase() === tokenName.toLowerCase();
        }
    });

    return matchingToken[0];
};

export const getTokenDetails = async (tokenId: string): Promise<TokenDetails> => {
    const url = `https://api.coingecko.com/api/v3/coins/${tokenId}?localization=false`;

    const body = await got.get(url).json<CoinDetailsInterface>();

    const { market_data, contract_address, asset_platform_id } = body;
    return { marketData: market_data, contractAddress: contract_address, platformId: asset_platform_id };
};
