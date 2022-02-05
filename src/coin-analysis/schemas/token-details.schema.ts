import BigNumberSchema from "mongoose-bignumber";
import { BigNumber } from "@0x/utils";
import { model, Schema, Document } from "mongoose";

export interface TokenDetails extends Document {
    tokenCode: string;
    tokenContract: string;
    priceInWei: BigNumber;
    priceTimestamp: Date;
    publishDate: Date;
    tokenPairs?: [string];
    tradingStartDate?: Date;
    purchased?: boolean;
    expired?: boolean;
    buyLock?: boolean;
    inTrading?: boolean;
}

const TokenDetailsSchema: Schema = new Schema({
    tokenCode: { type: String, required: true, unique: true },
    tokenContract: { type: String, required: true },
    publishDate: { type: Date, required: true },
    tokenPairs: { type: [String], required: false },
    tradingStartDate: { type: Date, required: false },
    purchased: { type: Boolean, required: false },
    priceInWei: { type: BigNumberSchema, required: true },
    priceTimestamp: { type: Date, required: true },
    expired: { type: Boolean, required: false },
    buyLock: { type: Boolean, required: false },
    inTrading: { type: Boolean, required: false },
});

export default model<TokenDetails>("tokendetails", TokenDetailsSchema);
