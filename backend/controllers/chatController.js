// Version 1.1.63 - Ultimate Names Only & Absolute Bypass
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage, sendImage, downloadMedia, sendAudio } from "../services/whatsappService.js";
import { generateTTS } from "../services/ttsService.js";
import axios from "axios";
import { connectDB } from "../config/db.js";

let isConnected = false;
const ensureDB = async () => {
    if (!isConnected) { await connectDB(); isConnected = true; }
}

const processedMessages = new Set();

export async function handleWebhook(req, res) {
    try {
        await ensureDB();
        const body = req.body;

        const msgId = body.messageId || body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || body.id;
        let textRaw = ""; // Define upfront
        
        // Use msgId + text preview for better deduplication
        const msgKey = `${msgId}_${sender || 'unknown'}`;
        if (msgId && processedMessages.has(msgKey)) return res.status(200).send("OK");
        if (msgId) {
            processedMessages.add(msgKey);
            setTimeout(() => processedMessages.delete(msgKey), 10000); // Shorter lock
        }

        let sender, type = "text", textRaw = "";
        let mId = msgId;
        let mediaUrlToDownload = null;

        if (body.from && body.content) {
            sender = body.from;
            type = body.content.contentType?.toLowerCase() || "text";
            
            if (type === "text") {
                textRaw = body.content.text || "";
            } else if (type === "media") {
                mediaUrlToDownload = body.content.media?.url || null;
                const mediaType = body.content.media?.type;
                if (mediaType === "voice" || mediaType === "audio") {
                    type = "audio";
                }
            }
            if (body.content.mediaId) mId = body.content.mediaId;
        } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            sender = msgObj.from;
            type = msgObj.type?.toLowerCase() || "text";
            mId = msgObj.audio?.id || msgObj.voice?.id || msgId;
            if (type === "text") textRaw = msgObj.text.body || "";
            if (msgObj.audio?.url) mediaUrlToDownload = msgObj.audio.url;
            if (msgObj.voice?.url) mediaUrlToDownload = msgObj.voice.url;
        } else if (body.messages?.[0]) {
            sender = body.messages[0].from;
            type = body.messages[0].type?.toLowerCase() || (body.messages[0].isAudio ? "audio" : "text");
            mId = body.messages[0].audio?.id || body.messages[0].voice?.id || msgId;
            textRaw = type === "text" ? (body.messages[0].text?.body || "") : "";
            if (body.messages[0].audio?.url) mediaUrlToDownload = body.messages[0].audio.url;
            if (body.messages[0].voice?.url) mediaUrlToDownload = body.messages[0].voice.url;
        }

        if (!sender) return res.status(200).send("OK");

        // FORCE RESET: Always start with fresh car detection to break loops
        let sessionToReset = await Session.findOne({ sender });
        if (sessionToReset) {
            sessionToReset.data.carModel = null;
            await sessionToReset.save();
        }

        if (type !== "text") {
            try {
                let buffer = null;
                let ext = "ogg";
                
                if (mediaUrlToDownload) {
                    try {
                        const mediaRes = await axios.get(mediaUrlToDownload, { 
                            responseType: "arraybuffer", 
                            timeout: 12000,
                            headers: { "Authorization": process.env.ZA_TOKEN }
                        });
                        buffer = Buffer.from(mediaRes.data);
                    } catch (directErr) {
                        buffer = await downloadMedia(mediaUrlToDownload);
                    }
                } else if (mId) {
                    buffer = await downloadMedia(mId);
                }
                
                if (buffer && buffer.length > 200) { 
                    textRaw = await transcribeAudio(buffer, ext);
                } else {
                    console.error("[BOT] Audio Fail - Empty Buffer");
                }
            } catch (err) { console.error("[BOT] STT Fail:", err.message); }
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";
        console.log(`[BOT] User Input: "${textRaw}" from ${sender}`);

        // 1. ABSOLUTE TOP BYPASS: CAR LISTS (NAMES ONLY)
        const isListQuery = /list|models|options|available|lineup|all suv|show cars|tell me cars|cars|gaadi|gaadiyan|batao|kaunse|konse/i.test(lowerMsg);
        if (isListQuery) {
            const namesOnlyList = `*Mahindra SUV Models* 🚗✨\n\n• Scorpio N \n• Thar \n• XUV700 \n• Bolero Neo \n• XUV 3XO \n• Bolero \n• XUV400 EV \n• Marazzo \n\n👉 Which one are you interested in?`;
            await sendMessage(sender, namesOnlyList);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: namesOnlyList, content: namesOnlyList }).save();
            return res.status(200).send("OK");
        }

        // 0. GREETINGS BYPASS (Word boundaries to avoid "book tHIss" issues)
        const greetingRegex = /\b(hi|hello|namaste|hey|hii|hy|naam)\b/i;
        const isBookingSearch = /(book|buy|interested|appointment|booking)/i.test(lowerMsg);

        if (greetingRegex.test(lowerMsg) && !isBookingSearch && lowerMsg.length < 15) {
            const welcomeMsg = /hindi|bhai|kya|batao|ka|se|hai|hu|ans|kaisa|aayega|swagat|apna/i.test(lowerMsg)
                ? "*Namaste, Mahindra Virtual Showroom mein aapka swagat hai!* 🚗✨"
                : "Hi, how can I help you with our Mahindra SUVs today? 🚗✨";
            await sendMessage(sender, welcomeMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: welcomeMsg, content: welcomeMsg }).save();
            return res.status(200).send("OK");
        }

        // 0.5 ACKNOWLEDGEMENT BYPASS (Nudge user to next step with Language Mirroring)
        const ackWords = /\b(ok|okay|kk|k|done|sweet|nice|thnx|thanks|thank you|shukriya|great|no thanks|no thank you)\b/i;
        if (ackWords.test(lowerMsg) && lowerMsg.length < 20) {
            const isHindi = /bhai|kya|batao|apne|aap|ka|se|hai|hu|kaisa|shukriya|shukran|nahi|nahi/i.test(lowerMsg);
            let session = await Session.findOne({ sender });
            const carName = session?.data?.carModel;

            let ackMsg = "";
            if (isHindi) {
                ackMsg = carName
                    ? `Great! Kya aap *${carName}* ki booking process ke liye aage badhna chahte hain? Ya kuch aur jaanna chahte hain? 🚗✨`
                    : "Ji bilkul! Kya aap kisi Mahindra SUV ke baare mein jaanna chahte hain ya booking process shuru karein? 🚗✨";
            } else {
                ackMsg = carName
                    ? `Great! Would you like to proceed with booking the *${carName}*? Or is there anything else you'd like to know? 🚗✨`
                    : "No problem! Would you like to explore our other SUVs, or is there anything else I can help with? 🚗✨";
            }

            await sendMessage(sender, ackMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: ackMsg, content: ackMsg }).save();
            return res.status(200).send("OK");
        }

        // 1. BOOKING CONFIRMATION BYPASS
        if (lowerMsg.startsWith("confirm_booking:")) {
            const parts = textRaw.split(":")[1].split("|");
            const date = parts[0] || "Select Date";
            const time = parts[1] || "Select Time";
            let session = await Session.findOne({ sender });
            const carName = session?.data?.carModel || "Mahindra SUV";
            const pc = session?.data?.pincode || "Not provided";
            const city = session?.data?.area || "Showroom Area";

            const successMsg = `*Booking Confirmed* ✅\n\n• Car: ${carName}\n• Pincode: ${pc}\n• Location: ${city}\n• Date: ${date}\n• Time: ${time}\n\nOur expert will call you shortly to confirm the appointment. 📞\n\nThank you for choosing Mahindra! ✨`;
            await sendMessage(sender, successMsg);

            // 👑 Notify Admin (+15558689519)
            const adminMsg = `*New Mahindra Lead* 🚨\n\n• Customer: ${sender}\n• Car: ${carName}\n• Pincode: ${pc}\n• Location: ${city}\n• Date: ${date}\n• Time: ${time}`;
            await sendMessage("15558689519", adminMsg);

            if (session) { session.state = "IDLE"; await session.save(); }
            return res.status(200).send("OK");
        }

        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [], language: "hinglish" } });
            await session.save();
        }

        // 2. PINCODE BYPASS
        const pincodeMatch = textRaw.match(/\b\d{6}\b/);
        if (session.state === "PINCODE" || pincodeMatch) {
            if (pincodeMatch) {
                const pc = pincodeMatch[0];
                let city = "Verified Area";
                try {
                    const pcRes = await axios.get(`https://api.postalpincode.in/pincode/${pc}`);
                    if (pcRes.data[0]?.Status === "Success") city = `${pcRes.data[0].PostOffice[0].District}, ${pcRes.data[0].PostOffice[0].State}`;
                } catch (e) { }
                session.data.pincode = pc;
                session.data.area = city;
                const carSlug = (session.data.carModel || "suv").toLowerCase().replace(/mahindra\s+/g, "").replace(/\s+/g, "-");
                const calLink = `https://honda-whatsapp-bot1-paje.vercel.app/booking/calendar?carId=${carSlug}&phone=${sender}&botPhone=15558689519`;
                const pincodeMsg = `📍 *Pincode Verified*: ${pc}\n🏢 *Location*: ${city}\n\nKripaya booking ke liye date aur time select karein:\n\n🔗 *Book Calendar*: ${calLink}`;
                session.state = "IDLE"; await session.save();

                // Lead Alert to Admin
                const leadAlert = `New Test Drive Lead! 🚀\n👤 Client: ${sender}\n🚗 Car: ${session.data.carModel || "Mahindra SUV"}\n📍 Area: ${city}\n📌 Pincode: ${pc}`;
                await sendMessage("15558689519", leadAlert);

                // Booking Link to User
                await sendMessage(sender, pincodeMsg);
                return res.status(200).send("OK");
            }
        }

        // 3. CAR DETECTION & SESSION CLEARING
        const isRecommendationQuery = /looking|suggest|recommend|best|for\s\d+/i.test(lowerMsg);
        if (isRecommendationQuery) {
            session.data.carModel = null;
            await session.save();
        }

        const carsList = await Car.find({});
        let detectedCar = null;
        for (const car of carsList) {
            const shortName = car.name.replace(/Mahindra\s+/i, "").toLowerCase().trim();
            const noSpaceName = shortName.replace(/\s+/g, "");
            const carRegex = new RegExp(`\\b${shortName}\\b`, 'i');
            const noSpaceMsg = lowerMsg.replace(/\s+/g, "");

            if (carRegex.test(lowerMsg) || shortName.includes(lowerMsg) || noSpaceName === noSpaceMsg || noSpaceMsg.includes(noSpaceName)) {
                detectedCar = car.name;
                break;
            }
        }

        if (detectedCar) {
            session.data.carModel = detectedCar;
            await session.save();
        }

        const isBookingAction = /\b(book this|book it|book now|confirmed book|proceed to book)\b/i.test(lowerMsg);
        const isBookingInfo = /\b(how to book|process|book kaise kare)\b/i.test(lowerMsg);
        const isDetailQuery = /detail|show|info|specs|price|mileage|image|photo|pic/i.test(lowerMsg);

        // 4. BOOKING BYPASS (CONFIRMATION ONLY - ACTION DRIVEN)
        if (isBookingAction && (detectedCar || session.data.carModel)) {
            const carName = detectedCar || session.data.carModel;
            session.state = "PINCODE";
            await session.save();

            const confirmMsg = `*Mahindra ${carName} is confirmed!* ✅ 🚙\n\nPlease share your 6-digit Pincode to continue with the booking process.`;
            await sendMessage(sender, confirmMsg);

            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: confirmMsg, content: confirmMsg }).save();
            return res.status(200).send("OK");
        }

        // 5. DETAIL BYPASS (REMOVED AS PER USER REQUEST - ALWAYS USE AI)
        /*
        const isExplicitDetail = /detail|show|info|specs|price|mileage|image|photo|pic|batao|kya hai/i.test(lowerMsg);
        if (detectedCar && (isExplicitDetail || lowerMsg.length < 15)) {
            // ... (Bypass disabled)
        }
        */


        const historyContext = (await Chat.find({ sender }).sort({ timestamp: -1 }).limit(3)).reverse()
            .map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        const aiFinal = await getAIResponse(textRaw || "Hi", historyContext, `${req.protocol}://${req.get('host')}`, session, type);
        await sendMessage(sender, aiFinal);

        await new Chat({ sender, role: "user", content: textRaw }).save();
        await new Chat({ sender, role: "assistant", reply: aiFinal, content: aiFinal }).save();

        return res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Fatal Webhook Error:", error.message);
        return res.status(200).send("OK");
    }
}

export function verifyWebhook(req, res) {
    if (req.query["hub.mode"] && req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
        return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(403).send("Forbidden");
}