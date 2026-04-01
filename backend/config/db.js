import mongoose from "mongoose";
import dns from "dns";

// 🔥 SMART DNS FIX: Only apply locally to fix Atlas SRV issues. Skip on Vercel to prevent EPERM crashes.
const isVercel = process.env.VERCEL || process.env.NOW_REGION;
if (!isVercel) {
    try {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        console.log("🌐 Local Environment: DNS servers set to Google (8.8.8.8)");
    } catch (e) {
        console.warn("⚠️ DNS override not supported, skipping.");
    }
}

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
    if (cached.conn) {
        if (mongoose.connection.readyState === 1) return cached.conn;
        cached.conn = null;
        cached.promise = null;
    }

    if (!cached.promise) {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error("❌ MONGO_URI missing!");
            return null;
        }

        cached.promise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 60000,
            bufferCommands: true,
        }).then((m) => {
            console.log(isVercel ? "✅ MongoDB Connected (Vercel)" : "✅ MongoDB Connected (Local)");
            return m;
        }).catch((err) => {
            console.error("❌ MongoDB Error:", err.message);
            cached.promise = null;
            throw err;
        });
    }
    
    cached.conn = await cached.promise;
    return cached.conn;
};