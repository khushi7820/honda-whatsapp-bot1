import { sendMessage, sendInteractiveMessage, downloadMedia } from "../services/whatsappService.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import * as templates from "../utils/bookingTemplates.js";
import { connectDB } from "../config/db.js";
import { getDealerByPincode } from "../utils/dealerData.js";

export const handleWebhook = async (req, res) => {
    try {
        await connectDB();
        
        console.log("📩 Webhook Payload:", JSON.stringify(req.body, null, 2));

        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        const sender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id;
        if (!sender) return res.status(200).send("OK");

        const interactive = msg.interactive || val.interactive || req.body.interactive || req.body.UserResponse;
        const type = msg.type || val.type || req.body.type || "text";
        
        const isMedia = req.body.content?.contentType === "media" || type === "audio" || type === "voice";
        const mediaObj = req.body.content?.media || val.media || {};
        const potentialUrl = mediaObj.url || mediaObj.link || req.body.media_url || val.media_url;

        let message = null;

        // 1. Audio Processing
        if (isMedia || potentialUrl) {
            if (potentialUrl && potentialUrl.startsWith("http")) {
                await sendMessage(sender, "Listening to your voice note... 🎧");
                const audioBuffer = await downloadMedia(potentialUrl);
                if (audioBuffer) {
                    message = await transcribeAudio(audioBuffer);
                    if (!message) {
                        await sendMessage(sender, "I couldn't hear that clearly. Can you try typing? 😊");
                        return res.status(200).send("OK");
                    }
                }
            }
        } else {
            message = req.body.content?.text || req.body.content?.body || (typeof req.body.content === 'string' ? req.body.content : null);
            if (typeof message === "object") message = message?.body || message?.text || "";
        }

        if (!message && !interactive && !isMedia) return res.status(200).send("OK");

        // 2. Main Logic
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        const lowerMsg = message?.toLowerCase() || "";

        // --- Booking logic ---
        const bookingKeywords = ["book test drive", "book drive", "test drive", "appointment", "booking"];
        if (bookingKeywords.some(k => lowerMsg.includes(k))) {
            const bookingData = session.data || {};
            session.state = "COLLECTING_CAR";
            await session.save();
            await sendMessage(sender, "Which Mahindra model would you like to book? (e.g., Thar, XUV700)");
            return res.status(200).send("OK");
        }

        // --- Fallback to AI ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(message, historyContextForAi, baseUrl);
        
        await new Chat({ sender, content: message, reply: aiResponse, role: "user" }).save();
        await sendMessage(sender, aiResponse);

        // Final Ack
        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ Webhook Error:", err.message);
        if (!res.headersSent) res.status(200).send("Error");
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};