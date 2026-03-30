import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
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
