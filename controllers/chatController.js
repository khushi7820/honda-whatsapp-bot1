import { sendMessage, sendInteractiveMessage, sendImage, downloadMedia } from "../services/whatsappService.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import Lead from "../models/Lead.js";
import { connectDB } from "../config/db.js";
import { getDealerByPincode } from "../utils/dealerData.js";

export const handleWebhook = async (req, res) => {
    try {
        console.log("📩 RAW PAYLOAD:", JSON.stringify(req.body, null, 2));

        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        // 1. EXTRACT SENDER & NAME
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "Unknown User";
        console.log(`[11ZA] Processing message from: ${sender} (${senderName})`);
        
        // 2. EXTRACT TEXT
        const textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || (typeof req.body.content === 'string' ? req.body.content : "");
        const lowerMsg = String(textRaw).toLowerCase().trim();

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
            return res.status(200).send("OK");
        }

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) {
            session = await new Session({ sender, state: "IDLE", data: {} }).save();
        }

        // --- PINCODE EXTRACTION & LEAD CREATION ---
        const pinMatch = String(message).match(/\b\d{6}\b/);
        if (pinMatch) {
            const pincode = pinMatch[0];
            session.data.pincode = pincode;
            const dealerInfo = getDealerByPincode(pincode);
            
            if (dealerInfo) {
                session.data.selectedDealer = dealerInfo.name;
                session.data.area = dealerInfo.area;
            }

            // Create Lead!
            try {
                await new Lead({
                    sender,
                    name: senderName,
                    carModel: session.data.carModel || "Unspecified",
                    pincode: pincode,
                    area: session.data.area || "Unknown",
                    selectedDealer: session.data.selectedDealer || "Pending",
                    color: session.data.color,
                    fuel: session.data.fuel
                }).save();
                console.log(`🚀 LEAD CREATED for ${senderName} (${sender})`);
            } catch (leadErr) {
                console.error("❌ Failed to create Lead:", leadErr.message);
            }
        }
        await session.save();

        // --- AI Response ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        let contextString = `\n--- USER CONTEXT ---\n`;
        if (session.data.pincode) contextString += `PINCODE PROVIDED: ${session.data.pincode}\n`;
        if (session.data.selectedDealer) {
            contextString += `AREA: ${session.data.area}\nDEALER: ${session.data.selectedDealer}\n`;
        }
        contextString += `---\n`;
        
        const aiResponse = await getAIResponse(message, historyContextForAi + contextString, baseUrl, session);
        await new Chat({ sender, content: message, reply: aiResponse, role: "user" }).save();
        
        console.log(`[11za] Sending reply to ${sender}...`);
        await sendMessage(sender, aiResponse);

        // 🎯 SMART IMAGE CAROUSEL/PREVIEW
        const carMatch = aiResponse.match(/gallery\/([a-z0-9-]+)/i);
        if (carMatch) {
            const carId = carMatch[1];
            const flexibleSearch = carId.replace(/-/g, '[\\s-]'); 
            const carDoc = await Car.findOne({ name: { $regex: new RegExp(flexibleSearch, 'i') } });
            
            if (carDoc && (carDoc.images?.length > 0 || carDoc.imageUrl)) {
                const img = carDoc.images?.[0] || carDoc.imageUrl;
                await sendImage(sender, img, `✨ The Stunning ${carDoc.name}`);
            }
        }

        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ WEBHOOK CRASH:", err.message);
        if (!res.headersSent) res.status(500).json({ status: "error", error: err.message });
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};