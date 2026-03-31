import { sendMessage, sendInteractiveMessage, sendImage, downloadMedia } from "../services/whatsappService.js";
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
        
        // 1. EXTRACT SENDER & SANITIZE (Remove '+' if present)
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        console.log(`[11ZA] Processing message from: ${sender}`);
        
        // 2. EXTRACT TEXT
        const textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || (typeof req.body.content === 'string' ? req.body.content : "");
        const lowerMsg = String(textRaw).toLowerCase().trim();

        console.log(`[11ZA] Msg Body: "${lowerMsg}"`);

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
                console.log(`[Audio] Downloading from: ${potentialUrl}`);
                const audioBuffer = await downloadMedia(potentialUrl);
                if (audioBuffer) {
                    message = await transcribeAudio(audioBuffer);
                    console.log(`[Audio] Success: "${message}"`);
                }
            }
        } else {
            message = textRaw;
        }

        if (!message && !interactive && !isMedia) {
            console.warn("[Webhook] No valid content in payload.");
            return res.status(200).send("OK");
        }

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) {
            console.log(`[Session] Creating new session for ${sender}`);
            session = await new Session({ sender, state: "IDLE", data: {} }).save();
        }

        // --- PINCODE EXTRACTION & SMART LOCALIZATION ---
        const pinMatch = String(message).match(/\b\d{6}\b/);
        let dealerInfo = null;
        let pincode = null;
        if (pinMatch) {
            pincode = pinMatch[0];
            session.data.pincode = pincode;
            dealerInfo = getDealerByPincode(pincode);
            if (dealerInfo) {
                session.data.selectedDealer = dealerInfo.name;
                session.data.area = dealerInfo.area;
                console.log(`📍 Found Local Dealer: ${dealerInfo.name}`);
            } else {
                console.log(`📍 Registered Pincode: ${pincode}`);
            }
        }
        await session.save();

        // --- AI Response ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        // Pass specialized context to AI
        let contextString = `\n--- USER CONTEXT ---\n`;
        if (pincode) contextString += `PINCODE PROVIDED: ${pincode}\n`;
        if (dealerInfo) {
            contextString += `AREA: ${dealerInfo.area}\nDEALER: ${dealerInfo.name}\nADDRESS: ${dealerInfo.address}\n`;
        } else if (pincode) {
            contextString += `NOTE: This pincode is valid, but no specific local branch mapping for now.\n`;
        }
        contextString += `---\n`;
        
        console.log(`[AI] Dispatching for ${sender}...`);
        const aiResponse = await getAIResponse(message, historyContextForAi + contextString, baseUrl, session);
        
        await new Chat({ sender, content: message, reply: aiResponse, role: "user" }).save();
        
        console.log(`[11za] Sending TEXT to ${sender}...`);
        const sendRes = await sendMessage(sender, aiResponse);
        console.log(`[11za] Send result:`, sendRes);

        // 🎯 SMART IMAGE CAROUSEL/PREVIEW
        const carMatch = aiResponse.match(/gallery\/([a-z0-9-]+)/i);
        if (carMatch) {
            const carId = carMatch[1];
            const flexibleSearch = carId.replace(/-/g, '[\\s-]'); 
            const carDoc = await Car.findOne({ name: { $regex: new RegExp(flexibleSearch, 'i') } });
            
            if (carDoc && (carDoc.images?.length > 0 || carDoc.imageUrl)) {
                const img = carDoc.images?.[0] || carDoc.imageUrl;
                console.log(`[11za] Sending IMAGE to ${sender}: ${img}`);
                await sendImage(sender, img, `✨ The Stunning ${carDoc.name}`);
            }
        }

        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ WEBHOOK CRASH:", err.message);
        console.error(err.stack);
        if (!res.headersSent) res.status(500).json({ status: "error", error: err.message });
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};