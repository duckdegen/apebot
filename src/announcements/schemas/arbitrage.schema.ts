import { model, Schema, Document } from "mongoose";

export interface Arbitrage extends Document {
    tokenPairs?: [string];
    tradingStartDate?: Date;
    tokenCode?: string;
    state?: string;
}

const ArbitrageSchema: Schema = new Schema({
    tradingStartDate: { type: Date, required: false },
    tokenPairs: { type: [String], required: false },
    tokenCode: { type: String, required: false },
    state: { type: String, required: false },
});

export default model<Arbitrage>("arbitrage", ArbitrageSchema);
