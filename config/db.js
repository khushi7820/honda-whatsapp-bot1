import mongoose from "mongoose";

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
        console.warn("⚠️ MongoDB connection stale. Reconnecting...");
        cached.conn = null;
        cached.promise = null;
    }

    if (!cached.promise) {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error("❌ CRITICAL: MONGO_URI is not defined in environment variables!");
            return null;
        }

        cached.promise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 20000, // Increased for serverless cold-starts
            socketTimeoutMS: 45000,
            bufferCommands: false,
        }).then((m) => {
            console.log("✅ MongoDB Connected (Vercel Ready)");
            return m;
        }).catch((err) => {
            console.error("❌ MongoDB connection failed:", err.message);
            cached.promise = null;
            cached.conn = null;
            throw err;
        });
    }
    
    cached.conn = await cached.promise;
    return cached.conn;
};