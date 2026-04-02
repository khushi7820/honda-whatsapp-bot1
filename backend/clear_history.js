import mongoose from "mongoose";
import dotenv from "dotenv";
import Chat from "./models/Chat.js";
import Session from "./models/Session.js";
import dns from "dns";

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const clearHistory = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await Chat.deleteMany({});
        await Session.deleteMany({});
        console.log("✅ Chat history and Sessions cleared! Ready for fresh Honda testing.");
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

clearHistory();
