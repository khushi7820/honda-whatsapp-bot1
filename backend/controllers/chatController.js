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
        let sender, type = "text", textRaw = "";
        const msgId = body.messageId || body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || body.id;

        // Extract sender early for msgKey
        if (body.from) sender = body.from;
        else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) sender = body.entry[0].changes[0].value.messages[0].from;
        else if (body.messages?.[0]) sender = body.messages[0].from;

        // Use msgId + sender for better deduplication
        const msgKey = `${msgId}_${sender || 'unknown'}`;
        if (msgId && processedMessages.has(msgKey)) return res.status(200).send("OK");
        if (msgId) {
            processedMessages.add(msgKey);
            setTimeout(() => processedMessages.delete(msgKey), 10000); // Shorter lock
        }

        let mId = msgId;
        let mediaUrlToDownload = null;

        if (body.from && body.content) {
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

        // STEP 1: FORCE RESET CAR CONTEXT ON EVERY REQUEST TO BREAK LOOPS
        let session = await Session.findOne({ sender });
        if (session) {
            session.data.carModel = null;
            await session.save();
        } else {
            session = new Session({ sender, state: "IDLE", data: { history: [], carModel: null } });
            await session.save();
        }

        // STEP 1.5: ROBUST MEDIA EXTRACTION
        let mediaIdToDownload = mId;

        if (type !== "text") {
            try {
                let buffer = null;
                console.log(`[Media Debug] Attempting download for type: ${type}, URL: ${mediaUrlToDownload}, ID: ${mediaIdToDownload}`);

                // Prioritize direct downloadMedia tool which handles token and format detection
                if (mediaUrlToDownload) {
                    buffer = await downloadMedia(mediaUrlToDownload);
                } else if (mediaIdToDownload) {
                    buffer = await downloadMedia(mediaIdToDownload);
                }

                if (buffer && buffer.length > 100) {
                    textRaw = await transcribeAudio(buffer, "ogg");
                    console.log(`[BOT] Transcription Success: "${textRaw}"`);
                } else {
                    console.error("[BOT] Audio Fail - Buffer too small or empty");
                }
            } catch (err) {
                console.error("[BOT] Audio/STT Fatal Fail:", err.message);
                textRaw = "";
            }
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";
        console.log(`[BOT] User Input: "${textRaw}" from ${sender}`);

        // 0. LANGUAGE DETECTION (Default to HINGLISH)
        if (!session.data.detectedLanguage || session.data.detectedLanguage === "ENGLISH") {
            if (/[\u0a80-\u0aff]/.test(textRaw)) session.data.detectedLanguage = "GUJARATI";
            else session.data.detectedLanguage = "HINGLISH";
            await session.save();
        } else if (/[\u0a80-\u0aff]/.test(textRaw)) {
            session.data.detectedLanguage = "GUJARATI";
            await session.save();
        } else {
            // Re-detect Hinglish just in case
            if (/hindi|bhai|kya|batao|ka|se|hai|hu|kaisa|apna|bolero|scorpio|xuv/i.test(lowerMsg)) {
                session.data.detectedLanguage = "HINGLISH";
                await session.save();
            }
        }

        // 0. GREETINGS BYPASS
        const greetingRegex = /\b(hi|hello|namaste|hey|hii|hy|hyy|heyy|hiii|naam|haa|hal|hoi)\b/i;
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

        // 0.5 ACKNOWLEDGEMENT BYPASS
        const ackWords = /\b(ok|okay|kk|k|done|sweet|nice|thnx|thanks|thank you|shukriya|great|no thanks|no thank you|no|nahi|nhi|fine|achha|theek)\b/i;
        if (ackWords.test(lowerMsg) && lowerMsg.length < 12) {
            let ackReply = "Great! Do you want to know anything else about our Mahindra SUVs? 🚗✨";
            if (/hindi|achha|theek|shukriya|nhi|nahi/i.test(lowerMsg)) ackReply = "Shukriya! Kya aap kisi aur Mahindra SUV ke baare mein jaan-na chahte hain? 🚗✨";
            if (/guj|saras|theek/i.test(lowerMsg)) ackReply = "ધન્યવાદ! શું તમે બીજી કોઈ મહિન્દ્રા SUV વિશે જાણવા માંગો છો? 🚗✨";
            
            await sendMessage(sender, ackReply);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: ackReply, content: ackReply }).save();
            return res.status(200).send("OK");
        }

        // 1. PINCODE BYPASS (Auto-detect in Audio/Text)
        const pincodeMatch = textRaw.match(/\b\d{6}\b/);
        if (pincodeMatch) {
            const pc = pincodeMatch[0];
            let city = "Verified Area";
            try {
                const pcRes = await axios.get(`https://api.postalpincode.in/pincode/${pc}`);
                if (pcRes.data[0]?.Status === "Success") {
                    const po = pcRes.data[0].PostOffice[0];
                    city = `${po.District}, ${po.State}`;
                }
            } catch (e) { }
            
            session.data.pincode = pc;
            session.data.area = city;
            
            const pincodeMsg = session.data.detectedLanguage === "GUJARATI" 
                ? `📍 *પિનકોડ વેરિફાઈડ: ${pc}*\n🏢 *સ્થળ*: ${city}\n\nતે બદલ આભાર! અમારા મહિન્દ્રા એક્સપર્ટ ટૂંક સમયમાં તમારો સંપર્ક કરશે. 🚙`
                : `📍 *Pincode Verified: ${pc}*\n🏢 *Location*: ${city}\n\nDhanyawad! Hamare Mahindra expert aage ki process ke liye aapko jald hi call karenge. 🚙`;
            
            // Lead Alert to Admin
            const leadAlert = `New Test Drive Lead! 🚀\n👤 Client: ${sender}\n🚗 Car: ${session.data.carModel || "Mahindra SUV"}\n📍 Area: ${city}\n📌 Pincode: ${pc}`;
            await sendMessage("15558689519", leadAlert);
            
            session.state = "IDLE"; await session.save();
            await sendMessage(sender, pincodeMsg);
            
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: pincodeMsg, content: pincodeMsg }).save();
            return res.status(200).send("OK");
        }

        // 3. CAR DETECTION & SESSION CLEARING
        const isRecommendationQuery = /looking|suggest|recommend|best|for\s\d+/i.test(lowerMsg);
        const isGeneralCarListQuery = /cars|gaadi|gadiyan|gaadiyan|models|inventory|available|kaunsi|kousi|dekhni|dikhao/i.test(lowerMsg) && !/(xuv|scorpio|thar|bolero|marazzo|3xo|ev|400)/i.test(lowerMsg);

        if (isRecommendationQuery) {
            session.data.carModel = null;
            await session.save();
        }

        if (isGeneralCarListQuery && lowerMsg.split(/\s+/).length < 10) {
            const cars = await Car.find({}).lean();
            const carListText = session.data.detectedLanguage === "GUJARATI"
                ? `અમારી પાસે આ મહિન્દ્રા ગાડીઓ છે:\n\n` + cars.map((c, i) => `${i + 1}. *${c.name}*`).join("\n") + `\n\nતમે કઈ ગાડી વિશે વધુ જાણવા માંગો છો? 🚗`
                : `Humare paas ye Mahindra cars hain:\n\n` + cars.map((c, i) => `${i + 1}. *${c.name}*`).join("\n") + `\n\nKripaya jis car ke bare mein janna ho, uska naam batayein. 🚗`;
            
            await sendMessage(sender, carListText);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: carListText, content: carListText }).save();
            return res.status(200).send("OK");
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

        const isBookingAction = /\b(book this|book it|book now|confirmed book|proceed to book|book kare|booking|book karna hai)\b/i.test(lowerMsg);
        const isBookingInfo = /\b(how to book|process|book kaise kare)\b/i.test(lowerMsg);
        const isDetailQuery = /detail|show|info|specs|price|mileage|image|photo|pic/i.test(lowerMsg);

        // 4. BOOKING BYPASS (CONFIRMATION ONLY - ACTION DRIVEN)
        if (isBookingAction && (detectedCar || session.data.carModel)) {
            const carName = detectedCar || session.data.carModel;
            session.state = "PINCODE";
            await session.save();

            const confirmMsg = `${carName} book karne ke liye apna 6-digit Pincode share karein. 🚙`;
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