import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
    sender: { type: String, required: true, unique: true },
    state: { type: String, default: "IDLE" }, // IDLE, BOOKING_START, COLLECTING_PINCODE, COLLECTING_DATE, COLLECTING_SLOT, CONFIRMING
    data: {
        pincode: String,
        date: String,
        slot: String,
        carModel: String
    },
    lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model("Session", SessionSchema);
