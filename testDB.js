import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

console.log("Loading MONGO_URI from env...");
console.log("MONGO_URI:", process.env.MONGO_URI ? "Loaded (hidden for security)" : "NOT LOADED");

const testConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Successfully connected to MongoDB Atlas! 🎉");
        process.exit();
    } catch (error) {
        console.error("Connection failed:", error);
        process.exit(1);
    }
};

testConnection();
