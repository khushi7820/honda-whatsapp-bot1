// Version 1.1.64 - Final Booking Flow (Overview + Pincode)
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage, sendImage, downloadMedia, sendAudio } from "../services/whatsappService.js";
import { generateTTS } from "../services/ttsService.js";
import { getBookButton, getDateListText, getSlotListText, getColorListText, getFuelListText } from "../utils/bookingTemplates.js";
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

        if (body.from) sender = body.from;
        else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) sender = body.entry[0].changes[0].value.messages[0].from;
        else if (body.messages?.[0]) sender = body.messages[0].from;

        const msgKey = `${msgId}_${sender || 'unknown'}`;
        if (msgId && processedMessages.has(msgKey)) return res.status(200).send("OK");
        if (msgId) {
            processedMessages.add(msgKey);
            setTimeout(() => processedMessages.delete(msgKey), 10000);
        }

        let mId = msgId;
        let mediaUrlToDownload = null;

        if (body.from && body.content) {
            type = body.content.contentType?.toLowerCase() || "text";
            if (type === "text") {
                textRaw = body.content.text || "";
            } else if (type === "media" || type === "audio" || type === "voice") {
                mediaUrlToDownload = body.content.media?.url || body.content.url || body.content.audio?.url || body.content.voice?.url || null;
                type = "audio";
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
        }

        if (!sender) return res.status(200).send("OK");

        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [], carModel: null } });
            await session.save();
        }

        if (type !== "text") {
            try {
                let buffer = await downloadMedia(mediaUrlToDownload || mId);
                if (buffer && buffer.length > 100) {
                    textRaw = await transcribeAudio(buffer, "ogg");
                } else {
                    const audioFailMsg = "Maaf kijiye, aapka audio sun nahi paaya. 🎤";
                    await sendMessage(sender, audioFailMsg);
                    return res.status(200).send("OK");
                }
            } catch (err) {
                const audioFailMsg = "Maaf kijiye, audio process nahi ho paaya. Kripaya text mein likhein. 🎤";
                await sendMessage(sender, audioFailMsg);
                return res.status(200).send("OK");
            }
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";

        // LANGUAGE DETECTION
        if (!session.data.detectedLanguage || session.data.detectedLanguage === "ENGLISH") {
            if (/[\u0a80-\u0aff]/.test(textRaw)) session.data.detectedLanguage = "GUJARATI";
            else session.data.detectedLanguage = "HINGLISH";
            await session.save();
        }

        // GREETINGS
        const greetingRegex = /\b(hi|hello|namaste|hey|hii|hy|hyy|heyy|hiii|naam|haa|hal|hoi)\b/i;
        if (greetingRegex.test(lowerMsg) && lowerMsg.length < 15) {
            const welcomeMsg = "Namaste! Mahindra Virtual Showroom mein aapka swagat hai. Main aapki kaise madad kar sakta hoon? 🚗✨";
            await sendMessage(sender, welcomeMsg);
            return res.status(200).send("OK");
        }

        // ACKNOWLEDGEMENT
        const ackWords = /\b(ok|okay|kk|k|done|sweet|nice|thnx|thanks|thank you|shukriya|great|no thanks|no|nhi|theek)\b/i;
        if (ackWords.test(lowerMsg) && lowerMsg.length < 12) {
            await sendMessage(sender, "Shukriya! Kya aap kisi aur Mahindra car ke baare mein jaan-na chahte hain? 🚗✨");
            return res.status(200).send("OK");
        }

        // FINAL WEB CONFIRMATION
        if (lowerMsg.startsWith("confirm_booking:")) {
            const parts = textRaw.split(":");
            const details = parts[1]?.split("|") || [];
            const bookingDate = details[0]?.trim() || "Selected Date";
            const bookingTime = details[1]?.trim() || "Selected Time";
            const carName = session.data.carModel || "Mahindra SUV";
            const pincode = session.data.pincode || "N/A";
            const location = session.data.area || "Verified Area";

            const finalConfirmMsg = `✅ Test Drive Confirmed!\n\n🚗 Car: ${carName}\n📅 Date: ${bookingDate}\n🕓 Time: ${bookingTime}\n📍 Pincode: ${pincode}\n🏢 Location: ${location}\n\nOur executive will call you shortly. Thank you! 🙏`;
            await sendMessage("15558689519", `🎉 SUCCESSFUL BOOKING!\n👤 Client: ${sender}\n🚗 Car: ${carName}\n📅 Date: ${bookingDate}\n🕓 Time: ${bookingTime}\n📍 Pincode: ${pincode}\n🏢 Location: ${location}`);
            session.state = "IDLE"; await session.save();
            await sendMessage(sender, finalConfirmMsg);
            return res.status(200).send("OK");
        }

        // PINCODE HANDLER
        const pincodeMatch = textRaw.match(/\b\d{6}\b/);
        if (pincodeMatch) {
            const pc = pincodeMatch[0];
            let city = "Verified Area";
            try {
                const pcRes = await axios.get(`https://api.postalpincode.in/pincode/${pc}`);
                if (pcRes.data[0]?.Status === "Success") city = `${pcRes.data[0].PostOffice[0].District}, ${pcRes.data[0].PostOffice[0].State}`;
            } catch (e) { }

            session.data.pincode = pc;
            session.data.area = city;
            const carName = session.data.carModel || "Mahindra SUV";
            const carId = carName.replace(/Mahindra\s+/i, "").toLowerCase().replace(/\s+/g, "-");
            const calendarUrl = `https://honda-whatsapp-bot1-paje.vercel.app/booking/calendar?carId=${carId}&phone=${sender.replace(/\D/g, "")}&botPhone=15558689519`;

            const pincodeMsg = `📍 Pincode Verified: ${pc}\n🏢 Location: ${city}\n\n✅ Schedule Your Test Drive!\n🚗 Car: ${carName}\n\nPlease click the link below to select your slot:\n📅 ${calendarUrl}\n\nThank you! 🙏`;
            await sendMessage("15558689519", `New Booking Intent! 🚀\n👤 Client: ${sender}\n🚗 Car: ${carName}\n📍 Area: ${city}\n📌 Pincode: ${pc}`);
            session.state = "IDLE"; await session.save();
            await sendMessage(sender, pincodeMsg);
            return res.status(200).send("OK");
        }

        // CAR LIST & DETECTOR
        const isImageRequest = /image|photo|pic|img/i.test(lowerMsg);
        const isGeneralCarListQuery = /cars|gaadi|gadiyan|models|inventory|available|kaunsi|kousi|dekhni|dikhao|list of/i.test(lowerMsg) && !isImageRequest && !/(xuv|scorpio|thar|bolero|marazzo|3xo|ev|400)/i.test(lowerMsg);

        if (isGeneralCarListQuery && lowerMsg.split(/\s+/).length < 10) {
            const cars = await Car.find({}).lean();
            session.data.lastShownList = cars.map(c => c.name); await session.save();
            const carListText = `Humare paas ye Mahindra cars hain:\n\n` + cars.map((c, i) => `${i + 1}. ${c.name}`).join("\n") + `\n\nKripaya car select karein ya number batayein. 🚗`;
            await sendMessage(sender, carListText);
            return res.status(200).send("OK");
        }

        const carsList = await Car.find({});
        let detectedCar = null;
        for (const car of carsList) {
            const shortName = car.name.toLowerCase().replace(/mahindra\s+/i, "").trim();
            if (lowerMsg.includes(shortName) || lowerMsg.replace(/\s+/g, "").includes(shortName.replace(/\s+/g, ""))) {
                detectedCar = car.name; break;
            }
        }
        if (detectedCar) { session.data.carModel = detectedCar; await session.save(); }

        const isBookingAction = /\b(book this|book it|book now|confirmed book|proceed to book|book kare|booking|book karna hai|book car|booking karwani hai|i want to book|want to book)\b/i.test(lowerMsg);

        // IMAGES BYPASS
        if (isImageRequest) {
            await sendMessage(sender, `Maaf kijiye, mere paas abhi photos available nahi hain. Lekin main aapko specifications air details bata sakta hoon. 🚗`);
            return res.status(200).send("OK");
        }

        // BOOKING BYPASS (OVERVIEW + PINCODE TOGETHER)
        if (isBookingAction) {
            if (!session.data.carModel && !detectedCar) {
                const cars = await Car.find({}).lean();
                session.data.lastShownList = cars.map(c => c.name); await session.save();
                const noCarMsg = `Booking ke liye pehle car select karein. Mahindra list:\n\n` + cars.map((c, i) => `${i + 1}. ${c.name}`).join("\n") + `\n\nKripaya car select karein. 🚗`;
                await sendMessage(sender, noCarMsg);
                return res.status(200).send("OK");
            } else {
                const carName = detectedCar || session.data.carModel;
                const car = await Car.findOne({ name: carName }).lean();
                session.state = "PINCODE";
                session.data.carModel = carName; await session.save();

                const overview = `Mahindra ${carName} 🚗\n💰 Price: ${car?.price || "N/A"}\n🎨 Colors: ${car?.colors?.join(", ") || "N/A"}\n⛽ Fuel: ${car?.fuelType || "N/A"}\n📊 Mileage: ${car?.mileage || "N/A"}\n💺 Seating: ${car?.seatingCapacity || "N/A"}`;
                const bookMsg = `${overview}\n\nAapki selection confirm ho gayi hai! 🚙 Pincode share karein taaki hum dealership verify kar sakein.`;
                
                await sendMessage(sender, bookMsg);
                return res.status(200).send("OK");
            }
        }

        // AI SERVICE
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