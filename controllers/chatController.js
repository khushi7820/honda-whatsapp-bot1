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
        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "Unknown User";
        
        const textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || "";
        const lowerMsg = String(textRaw).toLowerCase().trim();

        await connectDB();
        
        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // --- 1. STATE-BASED HANDLER (Handling Numbers 1, 2, 3...) ---
        if (session.state === "AWAITING_DATE" && /^[1-7]$/.test(lowerMsg)) {
            const index = parseInt(lowerMsg) - 1;
            const d = new Date();
            d.setDate(d.getDate() + index);
            const dateStr = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
            
            session.data.date = dateStr;
            session.state = "AWAITING_SLOT";
            await session.save();
            
            await sendMessage(sender, templates.getSlotListText(dateStr));
            return res.status(200).send("OK_PROCESSED_DATE");
        }

        if (session.state === "AWAITING_SLOT" && /^[1-4]$/.test(lowerMsg)) {
            const slots = ["10:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"];
            const slotStr = slots[parseInt(lowerMsg) - 1];
            
            session.data.time = slotStr;
            session.state = "IDLE"; // Reset to IDLE after full booking
            await session.save();
            
            const areaName = session.data.area || session.data.pincode;
            const dealerName = session.data.selectedDealer || 'our team';
            
            const confirmMsg = `✅ *Booking Confirmed!*\n\n*Name*: ${senderName}\n*Phone*: ${sender}\n*Car*: ${session.data.carModel || 'Mahindra SUV'}\n*Date*: ${session.data.date}\n*Time*: ${session.data.time}\n*Location*: ${areaName}\n\nAn executive from *${dealerName}* will contact you shortly!`;
            await sendMessage(sender, confirmMsg);
            
            // Finalize Lead
            await new Lead({
                sender,
                name: senderName,
                carModel: session.data.carModel || "Unspecified",
                pincode: session.data.pincode,
                area: session.data.area,
                selectedDealer: session.data.selectedDealer,
                date: session.data.date,
                time: session.data.time
            }).save();
            
            return res.status(200).send("OK_BOOKING_FINALIZED");
        }

        // --- 2. PINCODE DETECTION (Triggers AWAITING_DATE) ---
        const pinMatch = lowerMsg.match(/\b\d{6}\b/);
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
            session.state = "AWAITING_DATE";
            await session.save();
            
            // Send Text Calendar
            await sendMessage(sender, templates.getDateListText());
            return res.status(200).send("OK_STARTED_BOOKING_FLOW");
        }

        // --- 3. AI RESPONSE (Fallback) ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(textRaw || lowerMsg, historyContextForAi, baseUrl, session);
        await new Chat({ sender, content: textRaw || lowerMsg, reply: aiResponse, role: "user" }).save();
        
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