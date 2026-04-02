// Build Force: 2026-04-02T06:05:00Z - Integrated Master Rules & Audio Optimizations
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage, sendImage } from "../services/whatsappService.js";
import axios from "axios";

export async function handleWebhook(req, res) {
    try {
        console.log("📥 WEBHOOK RECEIVED...");
        const { connectDB } = await import("../config/db.js");
        await connectDB();

        const body = req.body;
        console.log("📦 BODY:", JSON.stringify(body, null, 2));

        let sender, type, textRaw = "";

        // Format normalization
        if (body.from && body.content) {
            sender = body.from;
            type = body.content.contentType || "text";
            if (type === "text") textRaw = body.content.text || "";
        } else if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            sender = msgObj.from;
            type = msgObj.type;
            if (type === "text") textRaw = msgObj.text.body;
        } else if (body.messages && body.messages[0]) {
            sender = body.messages[0].from;
            type = body.messages[0].isAudio ? "audio" : (body.messages[0].type || "text");
            textRaw = type === "text" ? body.messages[0].text.body : "";
        }

        if (!sender) return res.status(200).send("OK");

        // 🎤 Audio Processing
        if (type === "audio") {
            try {
                let mId = body.content?.mediaId || body.messages?.[0]?.audio?.id || body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.audio?.id || body.messageId;
                if (mId) {
                    const mUrl = `https://v1.11za.com/v1/media/${mId}`;
                    console.log(`🎤 Fetching: ${mUrl}`);
                    const resMedia = await axios.get(mUrl, {
                        headers: { 'Authorization': `Bearer ${process.env.ZA_TOKEN}` },
                        responseType: 'arraybuffer'
                    });
                    const buffer = Buffer.from(resMedia.data);
                    console.log(`🎤 Downloaded ${buffer.length} bytes`);
                    textRaw = await transcribeAudio(buffer) || "(Audio Empty)";
                    console.log("🎤 Final Transcript:", textRaw);
                } else {
                    textRaw = "(No Media ID found in audio message)";
                }
            } catch (err) {
                console.error("❌ Audio Error:", err.message);
                textRaw = `(Transcription Error: ${err.message})`;
            }
        }

        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [] } });
            await session.save();
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        // 🚀 GLOBAL CHECKS
        const cars = await Car.find({});
        let detectedCarName = null;
        for (const car of cars) {
            if (new RegExp(car.name, "i").test(textRaw)) {
                detectedCarName = car.name;
                break;
            }
        }

        const isBookingGoal = /(book|test drive|buy|interested|appointment|booking|chalana|dekhna)/i.test(lowerMsg);
        const greetings = ["hi", "hello", "hyy", "helo", "yo", "namaste", "hey", "hii", "hy", "heyy", "heyya", "hola", "hlo"];

        // State Escape (Allow greetings and car questions to break the flow)
        if (greetings.includes(lowerMsg) || (detectedCarName && !isBookingGoal)) {
            session.state = "IDLE";
            if (detectedCarName) session.data.carModel = detectedCarName;
            await session.save();
            if (greetings.includes(lowerMsg)) {
                await sendMessage(sender, "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?");
                return res.status(200).send("OK");
            }
        }

        // 🎯 STATE MACHINE
        if (session.state === "PINCODE") {
            const pincodeVal = textRaw.match(/\d{6}/);
            if (pincodeVal) {
                session.data.pincode = pincodeVal[0];
                session.data.area = "Mahindra Authorized Dealership";
                session.state = "COLOR_SELECTION";
                await session.save();
                const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, "Pincode verified. Ask for preferred color.");
                await sendMessage(sender, aiResponse);
                return res.status(200).send("OK");
            }
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, "Ask for a valid 6-digit Pincode.");
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        if (session.state === "COLOR_SELECTION") {
            session.data.color = textRaw;
            session.state = "DATE_SELECTION";
            await session.save();
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, "Ask for a Date for visit.");
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        if (session.state === "DATE_SELECTION") {
            session.data.date = textRaw;
            session.state = "TIME_SELECTION";
            await session.save();
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, "Ask for a specific Time.");
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        if (session.state === "TIME_SELECTION") {
            const summary = `📦 **BOOKING CONFIRMED** 🏁\n\n🚙 **Car Name**: ${session.data.carModel}\n📅 **Date & Time**: ${session.data.date} at ${textRaw}\n📍 **Location**: ${session.data.area}\n\nThank you! Visit again.`;
            session.state = "IDLE";
            await session.save();
            await sendMessage(sender, summary);
            return res.status(200).send("OK");
        }

        // Booking Intent
        if (isBookingGoal && (detectedCarName || session.data.carModel)) {
            session.state = "PINCODE";
            if (detectedCarName) session.data.carModel = detectedCarName;
            await session.save();
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, "User wants to book. ASK FOR PINCODE ONLY.");
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        // Final Fallback
        const aiResponse = await getAIResponse(textRaw || "Hello", historyContextForAi, baseUrl, session);
        await sendMessage(sender, aiResponse);
        
        await new Chat({ sender, role: "user", content: textRaw }).save();
        await new Chat({ sender, role: "assistant", reply: aiResponse }).save();

        if (detectedCarName) {
            const carObj = await Car.findOne({ name: detectedCarName });
            if (carObj?.imageUrl) await sendImage(sender, carObj.imageUrl, `Mahindra ${detectedCarName}`);
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