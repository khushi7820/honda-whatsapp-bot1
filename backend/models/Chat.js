import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    userMessage: {
        type: String,
        required: true
    },
    aiResponse: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
