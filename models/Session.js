import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
    sender: { type: String, required: true, unique: true },
    state: { type: String, default: "IDLE" }, 
    data: {
        pincode: String,
        date: String,
        time: String, // Consolidating slot/time to 'time'
        carModel: String,
        color: String,
        fuel: String
    },
    lastUpdated: { type: Date, default: Date.now }
});

// Update lastUpdated on every save
SessionSchema.pre('save', function(next) {
    this.lastUpdated = Date.now();
    next();
});

export default mongoose.model("Session", SessionSchema);
