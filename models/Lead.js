import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
    sender: { type: String, required: true }, // WhatsApp Number
    name: { type: String }, // From WhatsApp profile
    carModel: { type: String, required: true },
    pincode: { type: String, required: true },
    area: { type: String }, // Local area like 'Vesu'
    selectedDealer: { type: String },
    color: { type: String },
    fuel: { type: String },
    status: { type: String, enum: ['New', 'Contacted', 'Booked', 'Cancelled'], default: 'New' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Lead", LeadSchema);
