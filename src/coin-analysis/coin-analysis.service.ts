import TokenDetailsSchema, { TokenDetails } from "./schemas/token-details.schema";
import { Logger } from "tslog";
import { LeanDocument } from "mongoose";
import { BigNumber } from "@0x/utils";
const log: Logger = new Logger();

export interface CoinDTO {
    tokenCode: string;
    tokenContract: string;
    publishDate: Date;
    tokenPairs?: string[];
    tradingStartDate?: Date;
    purchased: boolean;
    priceInWei: BigNumber;
    priceTimestamp: Date;
}

export interface CoinUpdateDTO {
    tokenPairs: string[];
    tradingStartDate: Date;
}

export const loadToken = async (tokenCode: string): Promise<LeanDocument<TokenDetails>> => {
    return TokenDetailsSchema.findOne({ tokenCode: tokenCode }).lean().exec();
};
export const saveToken = async (dto: CoinDTO): Promise<TokenDetails> => {
    const {
        tokenCode,
        tokenContract,
        publishDate,
        tokenPairs,
        tradingStartDate,
        purchased,
        priceInWei,
        priceTimestamp,
    } = dto;

    return TokenDetailsSchema.create({
        tokenCode: tokenCode,
        tokenContract: tokenContract,
        publishDate: publishDate,
        tokenPairs: tokenPairs,
        priceInWei: priceInWei,
        priceTimestamp: priceTimestamp,
        tradingStartDate: tradingStartDate,
        purchased: purchased,
    });
};

export const updateToken = async (tokenCode: string, dto: CoinUpdateDTO): Promise<LeanDocument<TokenDetails>> => {
    return TokenDetailsSchema.findOneAndUpdate({ tokenCode: tokenCode }, dto, { new: true }).lean().exec();
};

export const findBuyableTokens = async (): Promise<LeanDocument<TokenDetails[]>> => {
    return TokenDetailsSchema.find({ purchased: false, buyLock: { $exists: false } })
        .lean()
        .exec();
};

export const markBuyableTokensInProcessing = async (tokenCode: string): Promise<LeanDocument<TokenDetails>> => {
    log.debug(`Locking ${tokenCode} for purchase`);
    return TokenDetailsSchema.findOneAndUpdate({ tokenCode: tokenCode }, { buyLock: true }).lean().exec();
};

export const markBuyableTokensAsPurchased = async (tokenCode: string): Promise<LeanDocument<TokenDetails>> => {
    log.debug(`Marking ${tokenCode} as purchased`);
    return TokenDetailsSchema.findOneAndUpdate({ tokenCode: tokenCode }, { purchased: true }).lean().exec();
};

export const findPurchasedTokens = async (): Promise<LeanDocument<TokenDetails[]>> => {
    return TokenDetailsSchema.find({ purchased: true, buyLock: true, inTrading: { $exists: false } })
        .lean()
        .exec();
};

export const findTokensReadyForTrading = async (): Promise<LeanDocument<TokenDetails[]>> => {
    return TokenDetailsSchema.find({ purchased: true, inTrading: true }).lean().exec();
};

export const markPurchasedTokensAsInTrading = async (tokenCode: string): Promise<LeanDocument<TokenDetails>> => {
    log.debug(`Marking ${tokenCode} as in trading`);
    return TokenDetailsSchema.findOneAndUpdate({ tokenCode: tokenCode }, { inTrading: true }).lean().exec();
};
