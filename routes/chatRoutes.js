import express from "express";
import { verifyWebhook, handleWebhook } from "../controllers/chatController.js";

const router = express.Router();

router.get("/webhook/whatsapp", verifyWebhook);
router.post("/webhook/whatsapp", handleWebhook);

export default router;