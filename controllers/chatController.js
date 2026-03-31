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
        
        // 1. EXTRACT SENDER & NAME
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "Unknown User";
        console.log(`[11ZA] Processing message from: ${sender} (${senderName})`);
        
        // 2. EXTRACT TEXT & INTERACTIVE DATA
        const textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || "";
        const lowerMsg = String(textRaw).toLowerCase().trim();
        
        const interactive = msg.interactive || val.interactive || req.body.interactive || req.body.UserResponse;
        const listId = interactive?.list_reply?.id;
        const btnId = interactive?.button_reply?.id;

        // 3. CONNECT DB
        await connectDB();
        
        const type = msg.type || val.type || req.body.type || "text";
        const isMedia = req.body.content?.contentType === "media" || type === "audio" || type === "voice";
        const potentialUrl = req.body.content?.media?.url || val.media?.url || req.body.media_url;

        let message = textRaw;
        if (isMedia && potentialUrl) {
            const audioBuffer = await downloadMedia(potentialUrl);
            if (audioBuffer) message = await transcribeAudio(audioBuffer);
        }

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        // 🎯 INTERACTIVE RESPONSE HANDLING (Calendar/Slots/Etc)
        if (listId) {
            if (listId.startsWith("date_")) {
                const dateLabel = interactive.list_reply.title;
                session.data.date = dateLabel;
                await session.save();
                console.log(`[Booking] Date Selected: ${dateLabel}`);
                await sendInteractiveMessage(sender, templates.getSlotList(dateLabel));
                return res.status(200).send("OK");
            }
            if (listId.startsWith("slot_")) {
                const slotLabel = interactive.list_reply.title;
                session.data.time = slotLabel;
                await session.save();
                console.log(`[Booking] Slot Selected: ${slotLabel}`);
                
                // Confirm booking and create lead
                const finalMsg = `✅ *Test Drive Scheduled!*\n\nVehicle: *${session.data.carModel}*\nDate: *${session.data.date}*\nTime: *${session.data.time}*\nLocation: *${session.data.area || session.data.pincode}*\n\nOur team from *${session.data.selectedDealer || 'Mahindra'}* will see you then!`;
                await sendMessage(sender, finalMsg);
                
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
                
                return res.status(200).send("OK");
            }
        }

        // --- PINCODE EXTRACTION & INTERACTIVE CALENDAR TRIGGER ---
        const pinMatch = String(message).match(/\b\d{6}\b/);
        if (pinMatch) {
            const pincode = pinMatch[0];
            session.data.pincode = pincode;
            const dealerInfo = getDealerByPincode(pincode);
            
            let locMsg = `📍 I see you're providing pincode ${pincode}.`;
            if (dealerInfo) {
                session.data.selectedDealer = dealerInfo.name;
                session.data.area = dealerInfo.area;
                locMsg = `📍 This pincode is for *${dealerInfo.area}*! We have a showroom there: *${dealerInfo.name}*.`;
            }
            
            await sendMessage(sender, locMsg);
            await session.save();
            
            // Trigger Date Selection
            await sendInteractiveMessage(sender, templates.getDateList());
            return res.status(200).send("OK");
        }

        // --- AI Response ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(message, historyContextForAi, baseUrl, session);
        await new Chat({ sender, content: message, reply: aiResponse, role: "user" }).save();
        
        await sendMessage(sender, aiResponse);

        // 🎯 IMAGE PREVIEW
        const carMatch = aiResponse.match(/gallery\/([a-z0-9-]+)/i);
        if (carMatch) {
            const carId = carMatch[1];
            const carDoc = await Car.findOne({ name: { $regex: new RegExp(carId.replace(/-/g, '[\\s-]'), 'i') } });
            if (carDoc) {
                const img = carDoc.images?.[0] || carDoc.imageUrl;
                await sendImage(sender, img, `✨ The Stunning ${carDoc.name}`);
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