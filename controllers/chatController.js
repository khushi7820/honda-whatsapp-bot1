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
        console.log("📩 RAW PAYLOAD:", JSON.stringify(req.body, null, 2));

        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        // 1. EXTRACT SENDER
        const sender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!sender) return res.status(200).send("OK");
        
        // 2. EXTRACT TEXT
        const textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || (typeof req.body.content === 'string' ? req.body.content : "");
        const lowerMsg = String(textRaw).toLowerCase().trim();

        console.log(`[11ZA] Msg from ${sender}: "${lowerMsg}"`);

        // 3. CONNECT DB
        await connectDB();
        
        const interactive = msg.interactive || val.interactive || req.body.interactive || req.body.UserResponse;
        const type = msg.type || val.type || req.body.type || "text";
        
        const isMedia = req.body.content?.contentType === "media" || type === "audio" || type === "voice";
        const mediaObj = req.body.content?.media || val.media || {};
        const potentialUrl = mediaObj.url || mediaObj.link || req.body.media_url || val.media_url;

        let message = null;

        // --- Audio Processing ---
        if (isMedia || potentialUrl) {
            if (potentialUrl && potentialUrl.startsWith("http")) {
                await sendMessage(sender, "Listening to your voice note... 🎧");
                const audioBuffer = await downloadMedia(potentialUrl);
                if (audioBuffer) {
                    message = await transcribeAudio(audioBuffer);
                }
            }
        } else {
            message = textRaw;
        }

        if (!message && !interactive && !isMedia) return res.status(200).send("OK");

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        // --- AI Response ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(message, historyContextForAi, baseUrl);
        
        await new Chat({ sender, content: message, reply: aiResponse, role: "user" }).save();
        await sendMessage(sender, aiResponse);

        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ Webhook Error:", err.stack);
        if (!res.headersSent) res.status(200).send("Error");
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};