import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
    sender: { type: String, required: true, unique: true },
    state: { type: String, default: "IDLE" }, 
    data: {
        pincode: String,
        area: String,
        selectedDealer: String,
        date: String,
        time: String,
        carModel: String,
        color: String,
        fuel: String,
        language: { type: String, default: "english" } // Added language tracking
    }
}, { 
    timestamps: true, // This replaces the need for the manually-created pre-save hook
    strict: false // As requested: unstrict so it supports extra dynamic fields without breaking old structure
});

export default mongoose.model("Session", SessionSchema);
