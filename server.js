import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";
import galleryRoutes from "./routes/galleryRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
    res.send("Mahindra Bot is Live! 🚀");
});

// Syncing with Dashboard URL: /api/chat/webhook
app.use("/api/chat", chatRoutes);
app.use("/gallery", galleryRoutes);
app.use("/booking", calendarRoutes);

const PORT = process.env.PORT || 5000;
const isVercel = process.env.VERCEL || process.env.NOW_REGION;

if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`🚀 Server locally active on port ${PORT}`);
    });
}

export default app;