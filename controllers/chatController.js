import { sendMessage, sendInteractiveMessage, sendImage, downloadMedia } from "../services/whatsappService.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import Lead from "../models/Lead.js";
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
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "Guest User";
        
        // 2. EXTRACT CONTENT (Text or Audio)
        let textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || "";
        const type = req.body.content?.contentType || msg.type || val.type || "text";
        const mediaUrl = req.body.content?.media?.url || val.media?.url || req.body.media_url;

        await connectDB();
        
        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // --- 🎥 AUDIO TRANSCRIPTION ---
        if ((type === "audio" || type === "voice" || req.body.content?.contentType === "audio") && mediaUrl) {
            console.log(`[Audio] Downloading from ${mediaUrl}...`);
            const audioBuffer = await downloadMedia(mediaUrl);
            if (audioBuffer) {
                const transcribed = await transcribeAudio(audioBuffer);
                if (transcribed) {
                    console.log(`[Audio] Transcribed: ${transcribed}`);
                    textRaw = transcribed;
                }
            }
        }

        const lowerMsg = String(textRaw).toLowerCase().trim();
        if (!lowerMsg && type === "text") return res.status(200).send("OK");

        // --- 🎯 0. GREETING HANDLER (Consistent Short Response) ---
        const greetings = ["hi", "hello", "hey", "hy", "hyy", "hii", "heyy"];
        if (greetings.includes(lowerMsg)) {
            session.state = "IDLE"; 
            session.data = {};
            await session.save();
            await sendMessage(sender, "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?");
            return res.status(200).send("OK");
        }

        // --- 🎯 1. STATE-BASED HANDLER (Handling Numbers 1, 2, 3...) ---
        if (session.state === "AWAITING_DATE" && /^[1-7]$/.test(lowerMsg)) {
            const index = parseInt(lowerMsg) - 1;
            const d = new Date();
            d.setDate(d.getDate() + index);
            const dateStr = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
            
            session.data.date = dateStr;
            session.state = "AWAITING_SLOT";
            await session.save();
            
            await sendMessage(sender, templates.getSlotListText(dateStr));
            return res.status(200).send("OK");
        }

        if (session.state === "AWAITING_SLOT" && /^[1-4]$/.test(lowerMsg)) {
            const slots = ["10:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"];
            const slotStr = slots[parseInt(lowerMsg) - 1];
            
            session.data.time = slotStr;
            const areaName = session.data.area || session.data.pincode;
            const dealerName = session.data.selectedDealer || 'Mahindra';
            
            const confirmMsg = `✅ *Test Drive Scheduled!*\n\n*Name*: ${senderName}\n*Phone*: ${sender}\n*Car*: ${session.data.carModel || 'Mahindra SUV'}\n*Date*: ${session.data.date}\n*Time*: ${session.data.time}\n*Location*: ${areaName}\n\nAn executive from *${dealerName}* will contact you to confirm!`;
            await sendMessage(sender, confirmMsg);
            
            await new Lead({
                sender,
                name: senderName,
                carModel: session.data.carModel,
                pincode: session.data.pincode,
                area: session.data.area,
                selectedDealer: session.data.selectedDealer,
                date: session.data.date,
                time: session.data.time
            }).save();
            
            session.state = "IDLE";
            await session.save();
            return res.status(200).send("OK");
        }

        // --- 🎯 2. PINCODE DETECTION ---
        const pinMatch = lowerMsg.match(/\b\d{6}\b/);
        if (pinMatch) {
            const pincode = pinMatch[0];
            session.data.pincode = pincode;
            const dealerInfo = getDealerByPincode(pincode);
            
            let locMsg = `📍 I see you're providing pincode ${pincode}.`;
            if (dealerInfo) {
                session.data.selectedDealer = dealerInfo.name;
                session.data.area = dealerInfo.area;
                locMsg = `📍 This pincode is for *${dealerInfo.area}*! Showroom: *${dealerInfo.name}*.`;
            }
            
            await sendMessage(sender, locMsg);
            session.state = "AWAITING_DATE";
            await session.save();
            await sendMessage(sender, templates.getDateListText());
            return res.status(200).send("OK");
        }

        // --- 🎯 3. AI RESPONSE (Premium Personas) ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session);
        await new Chat({ sender, content: textRaw, reply: aiResponse, role: "user" }).save();
        
        await sendMessage(sender, aiResponse);

        // IMAGE HANDLER
        const carMatch = aiResponse.match(/gallery\/([a-z0-9-]+)/i);
        if (carMatch) {
            const carId = carMatch[1];
            const carDoc = await Car.findOne({ name: { $regex: new RegExp(carId.replace(/-/g, '[\\s-]'), 'i') } });
            if (carDoc) {
                const img = carDoc.images?.[0] || carDoc.imageUrl;
                await sendImage(sender, img, `✨ Premium ${carDoc.name}`);
            }
        }

        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ WEBHOOK ERROR:", err.message);
        if (!res.headersSent) res.status(500).json({ status: "error", error: err.message });
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};