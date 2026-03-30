import mongoose from "mongoose";
import dns from "dns";

// Fix for Atlas SRV DNS resolution issues in some local environments
dns.setServers(["8.8.8.8", "1.1.1.1"]);

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
    // If we already have a ready connection, verify it's still alive
    if (cached.conn) {
        if (mongoose.connection.readyState === 1) {
            return cached.conn;
        }
        // Connection went stale — reset cache
        console.warn("⚠️ MongoDB connection stale (readyState:", mongoose.connection.readyState, "). Reconnecting...");
        cached.conn = null;
        cached.promise = null;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000, // 10s for cold-start DNS in serverless
            socketTimeoutMS: 45000,
            bufferCommands: false, // Fail fast instead of buffering when disconnected
        }).then((m) => {
            console.log("✅ MongoDB Connected (Serverless Ready)");
            return m;
        }).catch((err) => {
            // Reset the cached promise so next invocation retries
            console.error("❌ MongoDB connection failed:", err.message);
            cached.promise = null;
            cached.conn = null;
            throw err;
        });
    }
    
    cached.conn = await cached.promise;
    return cached.conn;
};