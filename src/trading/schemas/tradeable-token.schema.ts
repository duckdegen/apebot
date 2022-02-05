import { model, Schema, Document } from "mongoose";

export interface TradeableToken extends Document {
    tokenCode: string;
    tokenContract: string;
    tokenPairs: [string];
    tradingStartDate: Date;
    tokenAmountInWei: string;
    purchasePriceInWei?: number;
    sellPriceInUSD?: number;
    status?:
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
}

const TradeableTokenSchema: Schema = new Schema({
    tokenCode: { type: String, required: true, unique: true },
    tokenContract: { type: String, required: true },
    tokenPairs: { type: [String], required: true },
    tradingStartDate: { type: Date, required: true },
    tokenAmountInWei: { type: Number, required: true },
    purchasePriceInWei: { type: Number, required: false },
    sellPriceInUSD: { type: Number, required: false },
    status: { type: String, required: true },
});

export default model<TradeableToken>("tradeabletoken", TradeableTokenSchema);
