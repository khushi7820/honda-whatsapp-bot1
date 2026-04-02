// Version 1.1.46 - Hardcoded Pincode Request (For 100% No-Fluff Booking)
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage, sendImage, downloadMedia } from "../services/whatsappService.js";
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
        if (msgId && processedMessages.has(msgId)) return res.status(200).send("OK");
        if (msgId) {
            processedMessages.add(msgId);
            setTimeout(() => processedMessages.delete(msgId), 300000);
        }

        let sender, type = "text", textRaw = "";
        let mId = null;

        if (body.from && body.content) {
            sender = body.from;
            type = body.content.contentType?.toLowerCase() || "text";
            if (body.content.mediaId) {
                type = "audio";
                mId = body.content.mediaId;
            }
            if (type === "text") textRaw = body.content.text || "";
        } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            sender = msgObj.from;
            type = msgObj.type?.toLowerCase();
            if (type === "voice") type = "audio";
            if (type === "audio") mId = msgObj.audio?.id || msgObj.voice?.id;
            if (type === "text") textRaw = msgObj.text.body;
        } else if (body.messages?.[0]) {
            sender = body.messages[0].from;
            type = body.messages[0].type?.toLowerCase() || (body.messages[0].isAudio ? "audio" : "text");
            if (type === "voice") type = "audio";
            if (type === "audio") mId = body.messages[0].audio?.id || body.messages[0].voice?.id;
            textRaw = type === "text" ? body.messages[0].text.body : "";
        }

        if (!sender) return res.status(200).send("OK");

        if (type === "audio" || type === "voice") {
            try {
                if (!mId) mId = msgId;
                const buffer = await downloadMedia(`https://v1.11za.com/v1/media/${mId}`);
                if (buffer) {
                    textRaw = await transcribeAudio(buffer) || "(Audio Empty)";
                } else {
                    textRaw = "(Transcription Fail - Media Blocked)";
                }
            } catch (err) { textRaw = `(Transcription Error: ${err.message})`; }
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";

        // 1. FINAL BOOKING CONFIRMATION
        if (lowerMsg.startsWith("confirm_booking:")) {
            const parts = textRaw.split(":")[1].split("|");
            const date = parts[0] || "Select Date";
            const time = parts[1] || "Select Time";
            let session = await Session.findOne({ sender });
            const carName = session?.data?.carModel || "Mahindra SUV";
            const city = session?.data?.area || "Showroom Area";
            const successMsg = `✅ **Booking Confirmed!**\n\n**Car**: Mahindra ${carName}\n**Date**: ${date}\n**Time**: ${time}\n**Location**: ${city}\n\nOur team from **Mahindra Authorized Showroom** will call you shortly to confirm! 🚗💨✨`;
            await sendMessage(sender, successMsg);
            if (session) { session.state = "IDLE"; await session.save(); }
            await new Chat({ sender, role: "assistant", reply: successMsg, content: successMsg }).save();
            return res.status(200).send("OK");
        }

        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [], language: "hinglish" } });
            await session.save();
        }

        // Language Persistence
        const containsGujarati = /[\u0A80-\u0AFF]/.test(textRaw);
        const containsHindi = /[\u0900-\u097F]/.test(textRaw);
        if (containsGujarati) session.data.language = "gujarati";
        else if (containsHindi) session.data.language = "hinglish";
        else if (lowerMsg.includes("english")) session.data.language = "english";
        await session.save();

        const historyContext = (await Chat.find({ sender }).sort({ timestamp: -1 }).limit(3)).reverse()
            .map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        // 2. UNIVERSAL PINCODE LOOKUP STATE (Foolproof Global Trigger)
        const pincodeMatch = textRaw.match(/\b\d{6}\b/);
        if (session.state === "PINCODE" || pincodeMatch) {
            if (pincodeMatch) {
                const pc = pincodeMatch[0];
                let city = "Verified Area";
                try {
                    const pcRes = await axios.get(`https://api.postalpincode.in/pincode/${pc}`);
                    if (pcRes.data[0]?.Status === "Success") city = `${pcRes.data[0].PostOffice[0].District}, ${pcRes.data[0].PostOffice[0].State}`;
                } catch (e) {}
                session.data.pincode = pc;
                session.data.area = city;
                const carSlug = (session.data.carModel || "suv").toLowerCase().replace(/ /g, "-");
                const calLink = `https://honda-whatsapp-bot1-paje.vercel.app/booking/calendar?carId=${carSlug}&phone=${sender}`;
                const pincodeMsg = `📍 **Pincode Verified**: ${pc}\n🏢 **Location**: ${city}\n\nKripaya booking ke liye date aur time select karein:\n\n🔗 **Book Calendar**: ${calLink}`;
                session.state = "IDLE";
                await session.save();
                await sendMessage(sender, pincodeMsg);
                await new Chat({ sender, role: "user", content: textRaw }).save();
                await new Chat({ sender, role: "assistant", reply: pincodeMsg, content: pincodeMsg }).save();
                return res.status(200).send("OK");
            }
        }

        // Global Detection
        const carsList = await Car.find({});
        let detectedCar = null;
        for (const car of carsList) {
            if (new RegExp(car.name, "i").test(textRaw)) { detectedCar = car.name; break; }
        }

        const isBooking = /(book|buy|interested|appointment|booking|chalana|dekhna|drive)/i.test(lowerMsg);
        const greetings = ["hi", "hello", "namaste", "hey", "hii", "hy"];

        // State Escape
        if (greetings.includes(lowerMsg) || (detectedCar && !isBooking)) {
            session.state = "IDLE";
            if (detectedCar) session.data.carModel = detectedCar;
            await session.save();
            if (greetings.includes(lowerMsg)) {
                await sendMessage(sender, "Hi. Welcome to Mahindra. How can I assist you today?");
                return res.status(200).send("OK");
            }
        }

        // 3. HARDCODED BOOKING TRIGGER (Guarantees One-Line Pincode Request)
        if (isBooking && (detectedCar || session.data.carModel)) {
            session.state = "PINCODE";
            if (detectedCar) session.data.carModel = detectedCar;
            await session.save();
            const bookingPrompt = "Excellent! Please provide your 6-digit Pincode to continue with your request.";
            await sendMessage(sender, bookingPrompt);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: bookingPrompt, content: bookingPrompt }).save();
            return res.status(200).send("OK");
        }

        // Final Fallback
        const aiFinal = await getAIResponse(textRaw || "Hello", historyContext, `${req.protocol}://${req.get('host')}`, session);
        let finalOutput = (type === "audio" || type === "voice") ? `[Debug heard: ${textRaw}]\n\n` + aiFinal : aiFinal;
        await sendMessage(sender, finalOutput);
        await new Chat({ sender, role: "user", content: textRaw }).save();
        await new Chat({ sender, role: "assistant", reply: aiFinal, content: aiFinal }).save();

        if (detectedCar && session.state === "IDLE" && !isBooking) {
            const carObj = await Car.findOne({ name: detectedCar });
            if (carObj?.imageUrl) await sendImage(sender, carObj.imageUrl, `Mahindra ${detectedCar}`);
        }

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