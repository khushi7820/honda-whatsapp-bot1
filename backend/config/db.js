import mongoose from "mongoose";
import dns from "dns";

// Fix for Atlas SRV DNS resolution issues in some local environments
dns.setServers(["8.8.8.8", "1.1.1.1"]);

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }).then((m) => m);
    }
    
    cached.conn = await cached.promise;
    console.log("MongoDB Connected (Serverless Ready)");
    return cached.conn;
};