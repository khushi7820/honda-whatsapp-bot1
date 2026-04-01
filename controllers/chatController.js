import { sendMessage, sendInteractiveMessage, sendImage, downloadMedia } from "../services/whatsappService.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import Lead from "../models/Lead.js";
import * as templates from "../utils/bookingTemplates.js";
import { connectDB } from "../config/db.js";
import { getDealerByPincode } from "../utils/dealerData.js";
import axios from "axios";

export const handleWebhook = async (req, res) => {
    try {
        console.log("📩 WEBHOOK RECEIVED...");

        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        let rawSender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id || req.body.UserResponse?.from || req.body.whatsapp?.senderNumber;
        if (!rawSender) return res.status(200).send("OK");
        
        const sender = String(rawSender).replace(/^\+/, '');
        const senderName = val?.contacts?.[0]?.profile?.name || req.body.whatsapp?.senderName || "User";
        
        let textRaw = req.body.content?.text || req.body.content?.body || req.body.UserResponse || req.body.text || "";
        const mediaUrl = req.body.media_url || req.body.content?.media?.url || val.media?.url || msg.audio?.link || msg.voice?.link;
        const type = req.body.content?.contentType || msg.type || val.type || (req.body.media_url ? "audio" : "text");
        const isAudio = (type === "audio" || type === "voice" || (mediaUrl && mediaUrl.includes(".ogg")));

        await connectDB();
        
        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE", data: {} }).save();

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // Language Context Helper
        const talkInLanguage = async (englishText) => {
            if (!session.data.language || session.data.language === "english" || session.data.language === "en") return englishText;
            const translationAi = await getAIResponse(`Translate this to ${session.data.language}: ${englishText}`, "", baseUrl, session);
            return translationAi.replace(/\[LANG:.*?\]/g, "").trim();
        };

        // --- 🎥 AUDIO ---
        if (isAudio && mediaUrl) {
            const buffer = await downloadMedia(mediaUrl);
            if (buffer) {
                const transcribed = await transcribeAudio(buffer);
                if (transcribed) textRaw = transcribed;
            }
        }

        const lowerMsg = String(textRaw).toLowerCase().trim();

        // --- 🎯 0. GREETINGS ---
        const greetings = ["hi", "hello", "hey", "hyy", "hy", "hii", "heyy"];
        if (greetings.includes(lowerMsg)) {
            session.state = "IDLE"; 
            await session.save();
            const brandHi = "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?";
            await sendMessage(sender, brandHi); // Send in RAW English (No translation!)
            return res.status(200).send("OK");
        }

        // --- 🎯 WEB CALENDAR RETURN ---
        if (textRaw.startsWith("CONFIRM_BOOKING:")) {
            const parts = textRaw.split(":")[1].split("|");
            const dateStr = parts[0]; const timeStr = parts[1];
            session.data.date = dateStr; session.data.time = timeStr;
            const areaName = session.data.area || session.data.pincode;
            const dealerName = session.data.selectedDealer || 'Mahindra Dealer';
            
            const rawConfirm = `✅ *Test Drive Confirmed!*\n\n*Car*: ${session.data.carModel || 'Mahindra SUV'}\n*Date*: ${dateStr}\n*Time*: ${timeStr}\n*Location*: ${areaName}\n\nOur team from *${dealerName}* will call you shortly to confirm! 🏎️💨`;
            const translatedConfirm = await talkInLanguage(rawConfirm);
            await sendMessage(sender, translatedConfirm);
            
            await new Lead({
                sender, name: senderName, carModel: session.data.carModel, pincode: session.data.pincode,
                area: session.data.area, selectedDealer: session.data.selectedDealer, date: dateStr, time: timeStr
            }).save();
            
            session.state = "IDLE"; await session.save();
            return res.status(200).send("OK");
        }

        // --- 🎯 2. PINCODE LOOKUP (LIVE) ---
        const pinMatch = lowerMsg.match(/\b\d{6}\b/);
        if (pinMatch) {
            const pincode = pinMatch[0]; session.data.pincode = pincode;
            let displayLoc = "Your Area";
            try {
                const pinRes = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
                if (pinRes.data?.[0]?.Status === "Success") {
                    const po = pinRes.data[0].PostOffice[0];
                    displayLoc = `${po.Name}, ${po.District}`;
                }
            } catch (e) {}

            const dealerInfo = getDealerByPincode(pincode);
            if (dealerInfo) { session.data.selectedDealer = dealerInfo.name; session.data.area = dealerInfo.area; }
            else { session.data.selectedDealer = "Mahindra Dealer"; session.data.area = displayLoc; }
            
            const carId = session.data.carModel ? session.data.carModel.toLowerCase().replace(/\s+/g, '-') : "suv";
            const calendarLink = `${baseUrl}/booking/calendar?carId=${carId}&phone=${sender}`;
            
            const rawPrompt = `📍 Pincode: *${displayLoc}*!\n\nKripaya booking ke liye date aur time select karein: \n\n🔗 *Book Calendar*: ${calendarLink}`;
            const translatedPrompt = await talkInLanguage(rawPrompt);
            await sendMessage(sender, translatedPrompt);
            
            session.state = "IDLE"; await session.save();
            return res.status(200).send("OK");
        }

        // --- 🎯 3. AI RESPONSE ---
        if (!lowerMsg && type === "text") return res.status(200).send("OK");
        
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        let historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        // --- 🎯 LINGUISTIC SHIELD: FILTER OUT NON-MATCHING SCRIPTS ---
        const isEnglishScript = /^[A-Za-z0-9\s.,?!'"]+$/.test(textRaw);
        if (isEnglishScript) {
            // Remove any non-latin script (Gujarati, Marathi, etc.) to prevent AI distraction
            historyContextForAi = historyContextForAi.split("\n").filter(line => /^[A-Za-z0-9\s.,?!'":*-]+$/.test(line)).join("\n");
        }
        
        let aiResponse = await getAIResponse(textRaw || "Hello", historyContextForAi, baseUrl, session);
        
        // 🌏 LANGUAGE EXTRACTION
        const langMatch = aiResponse.match(/\[LANG:(.*?)\]/i);
        if (langMatch) {
            session.data.language = langMatch[1].trim();
            aiResponse = aiResponse.replace(/\[LANG:.*?\]/g, "").trim();
            await session.save();
        }

        await new Chat({ sender, content: textRaw || "audio", reply: aiResponse, role: "user" }).save();
        await sendMessage(sender, aiResponse);

        // --- 🎯 SMART CAR MODEL DETECTION ---
        const allCars = await Car.find({});
        let detectedCar = null;

        // Check for car names in AI Response or User Message
        for (const car of allCars) {
            const carRegex = new RegExp(`\\b${car.name}\\b`, 'i');
            if (carRegex.test(aiResponse) || carRegex.test(textRaw)) {
                detectedCar = car;
                break;
            }
        }

        if (detectedCar) {
            session.data.carModel = detectedCar.name;
            await session.save();
            console.log(`📌 DETECTED CAR: ${detectedCar.name}`);
            
            // Send Image Preview (No link, just the photo!)
            const imgSource = detectedCar.images?.[0] || detectedCar.imageUrl;
            const finalImgUrl = imgSource.startsWith("/") ? `${baseUrl}${imgSource}` : imgSource;
            await sendImage(sender, finalImgUrl, `✨ Premium ${detectedCar.name}`);
        }
        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        if (!res.headersSent) res.status(500).json({ status: "error" });
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};