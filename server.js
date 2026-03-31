import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";
import galleryRoutes from "./routes/galleryRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";

// Global error capture for Vercel debugging
process.on("uncaughtException", (err) => {
    console.error("CRITICAL ERROR:", err.stack);
});

dotenv.config();
const app = express();

(async () => {
    try {
        console.log("🛠️ Attempting DB Connection...");
        await connectDB();
        console.log("✅ DB Connected Successfully!");
    } catch (err) {
        console.error("❌ DB Connection Failed:", err.message);
    }
})();

app.use(cors());
app.use(express.json());

// Main Entry Point
app.get("/", (req, res) => {
    res.status(200).send("Mahindra Bot is Live! 🚀 Status: Online");
});

// Sync with Dashboard: /api/chat/webhook & /api/webhook/whatsapp
app.use("/api/chat", chatRoutes);

// Direct support for the second common URL pattern
import { handleWebhook, verifyWebhook } from "./controllers/chatController.js";
app.post("/api/webhook/whatsapp", handleWebhook);
app.get("/api/webhook/whatsapp", verifyWebhook);

app.use("/gallery", galleryRoutes);
app.use("/booking", calendarRoutes);

// Health check with debug info for Vercel
app.get("/health", async (req, res) => {
    try {
        await connectDB();
        res.status(200).json({ 
            status: "OK", 
            db: "Connected", 
            env: process.env.VERCEL ? "Production" : "Local",
            version: "1.0.5",
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

const isVercel = process.env.VERCEL || process.env.NOW_REGION;
if (!isVercel) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server locally active on port ${PORT}`);
    });
}

export default app;