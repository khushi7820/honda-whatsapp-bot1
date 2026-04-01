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
        
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "Guest User";
        
        let textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || "";
        
        // 🔎 ENHANCED AUDIO DETECTION
        const type = req.body.content?.contentType || msg.type || val.type || (req.body.media_url ? "audio" : "text");
        const mediaUrl = req.body.content?.media?.url || val.media?.url || req.body.media_url || msg.audio?.link || msg.voice?.link;

        await connectDB();
        
        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // --- 🎥 AUDIO TRANSCRIPTION BLOCK ---
        if ((type === "audio" || type === "voice") && mediaUrl) {
            console.log(`[Audio Debug] Type: ${type}, URL: ${mediaUrl}`);
            try {
                const audioBuffer = await downloadMedia(mediaUrl);
                if (audioBuffer && audioBuffer.length > 0) {
                    console.log(`[Audio Debug] Download Success! Buffer size: ${audioBuffer.length}`);
                    const transcribed = await transcribeAudio(audioBuffer);
                    if (transcribed) {
                        console.log(`[Audio Debug] Transcribed Text: "${transcribed}"`);
                        textRaw = transcribed;
                    } else {
                        console.error("[Audio Debug] Transcription failed or returned empty.");
                    }
                } else {
                    console.error("[Audio Debug] Failed to download or empty buffer.");
                }
            } catch (aErr) {
                console.error("[Audio Debug] Critical Transcription Error:", aErr.message);
            }
        }

        const lowerMsg = String(textRaw).toLowerCase().trim();

        // --- 🎯 0. GREETING HANDLER ---
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
            const promptMsg = `📍 This pincode is for *${dealerInfo?.area || 'your area'}*!\n\nKripaya apna comfortable date aur time select karne ke liye niche di gayi link par click karein: \n\n🔗 *Book Calendar*: ${calendarLink}`;
            
            await sendMessage(sender, promptMsg);
            session.state = "IDLE";
            await session.save();
            return res.status(200).send("OK_PIN_HANDLED");
        }

        // --- 🎯 3. AI RESPONSE ---
        if (!lowerMsg && (type === "text")) return res.status(200).send("OK_EMPTY");

        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session);
        await new Chat({ sender, content: textRaw, reply: aiResponse, role: "user" }).save();
        
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
        console.error("❌ WEBHOOK ERROR:", err.message);
        if (!res.headersSent) res.status(500).json({ status: "error", error: err.message });
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};