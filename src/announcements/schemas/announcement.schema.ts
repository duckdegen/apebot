import { model, Schema, Document } from "mongoose";

export interface Announcement extends Document {
    url: string;
    dateFound: Date;
    newListingText?: string;
    textContent?: string;
    tokenPairs?: [string];
    tradingStartDate?: Date;
    title?: string;
    tokenCode?: string;
    tokenCommonName?: string;
    state?: string;
    publishDate: Date;
}

const AnnouncementSchema: Schema = new Schema({
    url: { type: String, required: true, unique: true },
    dateFound: { type: Date, required: true },
    tradingStartDate: { type: Date, required: false },
    newListingText: { type: String, required: false },
    tokenPairs: { type: [String], required: false },
    tokenCode: { type: String, required: false },
    tokenCommonName: { type: String, required: false },
    textContent: { type: String, required: false },
    title: { type: String, required: false },
    state: { type: String, required: false },
    publishDate: { type: Date, required: false },
});

export default model<Announcement>("announcement", AnnouncementSchema);
