import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";
import galleryRoutes from "./routes/galleryRoutes.js";

// Load env variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect Database once
connectDB();

// Test route
app.get("/", (req, res) => {
    res.send("Server running 🚀");
});

// API Routes
app.use("/api", chatRoutes);
app.use("/gallery", galleryRoutes);

// Server start
const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running local on port ${PORT} 🚀`);
    });
}


export default app;