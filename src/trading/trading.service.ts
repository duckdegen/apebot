import TradeableTokenSchema, { TradeableToken } from "./schemas/tradeable-token.schema";
import { Logger } from "tslog";
import { BigNumber } from "@0x/utils";
import { sendErc20Tokens } from "../wallet/wallet.controller";
import type { TransactionReceipt } from "web3-core/types";
import { LeanDocument } from "mongoose";
const log: Logger = new Logger();

export type tokenStatuses =
    | "purchased"
    | "sendingToBinance"
    | "sentToBinance"
    | "availableOnBinance"
    | "readyForTrading"
    | "inTrading"
    | "sellingInProgress"
    | "soldOnBinance"
    | "convertingOnBinance"
    | "convertedOnBinance"
    | "withdrawnFromBinance";

export interface TradeableCoinDTO {
    tokenCode: string;
    tokenContract: string;
    tokenPairs: string[];
    tradingStartDate: Date;
    tokenAmountInWei: BigNumber;
    purchasePriceInWei: BigNumber;
    sellPriceInUSD: number;
    status?: tokenStatuses;
}
export const importTradeableToken = async (dto: TradeableCoinDTO): Promise<TradeableToken> => {
    const { tokenCode, tokenContract, tokenPairs, tradingStartDate, tokenAmountInWei } = dto;

    return TradeableTokenSchema.create({
        tokenCode,
        tokenContract,
        tokenPairs,
        tradingStartDate,
        tokenAmountInWei: tokenAmountInWei.toFixed(),
        status: "purchased",
    });
};

export const changeTokenStatus = async (
    tokenCode: string,
    status: tokenStatuses
): Promise<LeanDocument<TradeableToken>> => {
    log.debug(`Marking ${tokenCode} as ${status}`);
    return TradeableTokenSchema.findOneAndUpdate({ tokenCode: tokenCode }, { status: status }).lean().exec();
};

export const findTokensByStatus = async (status: tokenStatuses): Promise<LeanDocument<TradeableToken>[]> => {
    return TradeableTokenSchema.find({ status: status }).lean().exec();
};

interface sendToBinanceDTO {
    tokenContract: string;
    gasPrice: BigNumber;
    myAddress: string;
    binanceAddress: string;
}
export const sendToBinance = async (dto: sendToBinanceDTO): Promise<TransactionReceipt> => {
    const { tokenContract, gasPrice, myAddress, binanceAddress } = dto;

    return sendErc20Tokens({
        tokenContract: tokenContract,
        walletAddress: myAddress,
        recipientAddress: binanceAddress,
        gasPrice: gasPrice,
    });
};
