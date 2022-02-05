import { BigNumber } from "@0x/utils";
import type { QuoteFrom0x } from "./interfaces/0x-quote.interface";
import got from "got";

interface getQuoteDTO {
    targetToken: string;
    tradeAmountInWei: BigNumber;
    takerAddress: string;
}
export const getQuoteForToken = async (dto: getQuoteDTO): Promise<QuoteFrom0x> => {
    const { targetToken, tradeAmountInWei, takerAddress } = dto;

    const params = {
        buyToken: targetToken,
        sellToken: "ETH",
        sellAmount: tradeAmountInWei.toFixed(0),
        takerAddress: takerAddress,
        slippagePercentage: 0.045,
    };
    console.debug(JSON.stringify(params));
    return got("https://api.0x.org/swap/v1/quote", { searchParams: params }).json<QuoteFrom0x>();
};
