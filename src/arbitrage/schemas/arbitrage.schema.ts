import { model, Schema, Document } from "mongoose";

export type ArbitrageState =
    | "waitingForArbitrage"
    | "readyForArbitrage"
    | "inArbitrage"
    | "sellingInProgress"
    | "soldOnBinance";

export interface Arbitrage extends Document {
    tokenCode: string;
    tokenPairs: [string];
    tradingStartDate: Date;
    state: ArbitrageState;
}

const ArbitrageSchema: Schema = new Schema({
    tokenCode: { type: String, required: true, unique: true },
    tokenPairs: { type: [String], required: true },
    tradingStartDate: { type: Date, required: true },
    state: { type: String, required: true },
});

export default model<Arbitrage>("arbitrage", ArbitrageSchema);
