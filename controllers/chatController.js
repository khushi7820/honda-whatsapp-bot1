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
        console.log("📩 [DEBUG] WEBHOOK PAYLOAD RECEIVED:", JSON.stringify(req.body, null, 2));

        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        // 1. ROBUST SENDER EXTRACTION
        let rawSender = req.body.from || 
                        msg.from || 
                        req.body.sender || 
                        val.contacts?.[0]?.wa_id || 
                        req.body.UserResponse?.from || 
                        req.body.whatsapp?.senderNumber;

        if (!rawSender) {
            console.warn("⚠️ [DEBUG] No Sender found in payload.");
            return res.status(200).send("OK_NO_SENDER");
        }
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "User";
        
        // 2. ROBUST CONTENT EXTRACTION
        let textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || "";
        
        // 🔎 MASTER MEDIA CHECK (Checking every possible 11za field)
        const mediaUrl = req.body.media_url || 
                         req.body.content?.media?.url || 
                         val.media?.url || 
                         msg.audio?.link || 
                         msg.voice?.link || 
                         val.messages?.[0]?.audio?.link;

        const isAudio = (req.body.content?.contentType === "audio") || 
                        (msg.type === "audio") || 
                        (msg.type === "voice") || 
                        (mediaUrl && mediaUrl.includes(".ogg")) ||
                        (req.body.type === "audio");

        console.log(`🔎 [DEBUG] Processing Message from ${sender}. isAudio: ${isAudio}, mediaUrl: ${mediaUrl}`);

        await connectDB();
        
        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // --- 🎥 AUDIO PROCESSING ---
        if (isAudio && mediaUrl) {
            console.log(`[Audio] 🚀 Starting transcription for ${mediaUrl}`);
            try {
                const audioBuffer = await downloadMedia(mediaUrl);
                if (audioBuffer && audioBuffer.length > 0) {
                    const transcribed = await transcribeAudio(audioBuffer);
                    if (transcribed) {
                        console.log(`[Audio] ✅ SUCCESS: "${transcribed}"`);
                        textRaw = transcribed;
                    } else {
                        console.error("[Audio] ❌ Transcription returned empty.");
                    }
                } else {
                    console.error("[Audio] ❌ Buffer is empty after download.");
                }
            } catch (aErr) {
                console.error("[Audio] ❌ Crash during audio process:", aErr.message);
            }
        }

        const lowerMsg = String(textRaw).toLowerCase().trim();

        // --- 🎯 0. GREETING HANDLER (hi/hello check) ---
        const greetings = ["hi", "hello", "hey", "hyy", "hy", "hii", "heyy"];
        if (greetings.includes(lowerMsg)) {
            session.state = "IDLE";
            session.data = {};
            await session.save();
            await sendMessage(sender, "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?");
            return res.status(200).send("OK_GREETED");
        }

        // --- 🎯 WEB CALENDAR RETURN ---
        if (textRaw.startsWith("CONFIRM_BOOKING:")) {
            const parts = textRaw.split(":")[1].split("|");
            const dateStr = parts[0];
            const timeStr = parts[1];
            
            session.data.date = dateStr;
            session.data.time = timeStr;
            const areaName = session.data.area || session.data.pincode;
            const dealerName = session.data.selectedDealer || 'Mahindra';
            
            await sendMessage(sender, `✅ *Test Drive Confirmed!*\n\n*Car*: ${session.data.carModel || 'Mahindra SUV'}\n*Date*: ${dateStr}\n*Time*: ${timeStr}\n*Location*: ${areaName}\n\nOur team from *${dealerName}* will call you shortly to confirm! 🏎️💨`);
            
            await new Lead({
                sender,
                name: senderName,
                carModel: session.data.carModel,
                pincode: session.data.pincode,
                area: session.data.area,
                selectedDealer: session.data.selectedDealer,
                date: dateStr,
                time: timeStr
            }).save();
            
            session.state = "IDLE";
            await session.save();
            return res.status(200).send("OK_CONFIRMED");
        }

        // --- 🎯 2. PINCODE DETECTION ---
        const pinMatch = lowerMsg.match(/\b\d{6}\b/);
        if (pinMatch) {
            const pincode = pinMatch[0];
            session.data.pincode = pincode;
            const dealerInfo = getDealerByPincode(pincode);
            if (dealerInfo) {
                session.data.selectedDealer = dealerInfo.name;
                session.data.area = dealerInfo.area;
            }
            
            const carId = session.data.carModel ? session.data.carModel.toLowerCase().replace(/\s+/g, '-') : "suv";
            const calendarLink = `${baseUrl}/booking/calendar?carId=${carId}&phone=${sender}`;
            const promptMsg = `📍 Pincode: *${dealerInfo?.area || 'your area'}*!\n\nKripaya booking ke liye date aur time select karein: \n\n🔗 *Book Calendar*: ${calendarLink}`;
            
            await sendMessage(sender, promptMsg);
            session.state = "IDLE";
            await session.save();
            return res.status(200).send("OK_PINCODE");
        }

        // --- 🎯 3. AI RESPONSE ---
        if (!lowerMsg && (type === "text")) {
           console.warn(`[DEBUG] Empty message, skipping AI.`);
           return res.status(200).send("OK_EMPTY");
        }

        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(textRaw || "Hello", historyContextForAi, baseUrl, session);
        await new Chat({ sender, content: textRaw || "audio_message", reply: aiResponse, role: "user" }).save();
        
        await sendMessage(sender, aiResponse);

        // Memory & Image Preview
        const carMatch = aiResponse.match(/gallery\/([a-z0-9-]+)/i);
        if (carMatch) {
            const carIdMatch = carMatch[1];
            const carDoc = await Car.findOne({ name: { $regex: new RegExp(carIdMatch.replace(/-/g, '[\\s-]'), 'i') } });
            if (carDoc) {
                session.data.carModel = carDoc.name;
                await session.save();
                await sendImage(sender, carDoc.images?.[0] || carDoc.imageUrl, `✨ Premium ${carDoc.name}`);
            }
        }

        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ WEBHOOK ERROR:", err.message, err.stack);
        if (!res.headersSent) res.status(500).json({ status: "error", error: err.message });
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};