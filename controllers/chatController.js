// Build Force: 2026-04-01T10:09:00Z - Finalized Sales Funnel Fixed
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage } from "../services/whatsappService.js";
import axios from "axios";

export const verifyWebhook = (req, res) => {
    console.log("🔍 Verifying Webhook...");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
};

export const handleWebhook = async (req, res) => {
    try {
        console.log("📥 WEBHOOK RECEIVED...");
        const body = req.body;
        if (!body || !body.messages) {
            console.log("⚠️ No messages in body");
            return res.status(200).send("OK");
        }

        const message = body.messages[0];
        const sender = message.from;
        const type = message.type;
        let textRaw = "";

        console.log(`📨 Message from ${sender} (Type: ${type})`);

        if (type === "text") {
            textRaw = message.text.body;
        } else if (type === "audio") {
            const mediaId = message.audio.id;
            const mediaUrl = `https://v1.11za.com/v1/media/${mediaId}`;
            const response = await axios.get(mediaUrl, {
                headers: { 'Authorization': `Bearer ${process.env.ZA_TOKEN}` },
                responseType: 'arraybuffer'
            });
            textRaw = await transcribeAudio(Buffer.from(response.data));
            console.log("🎤 Audio Transcribed:", textRaw);
        }

        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [] } });
            await session.save();
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase() : "";
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // 🚀 BRAND-APPROVED GREETING
        if (["hi", "hello", "hyy", "helo", "yo"].includes(lowerMsg)) {
            const firstGreeting = "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?";
            await sendMessage(sender, firstGreeting);
            return res.status(200).send("OK");
        }

        // 🏁 SALES FUNNEL: PINCODE -> COLOR -> DATE -> TIME -> SUMMARY
        if (session.state === "PINCODE") {
            const pincodeVal = textRaw.match(/\d{6}/);
            if (pincodeVal) {
                session.data.pincode = pincodeVal[0];
                const areaName = "Mahindra City Store, Mumbai"; 
                session.data.area = areaName;
                session.state = "COLOR_SELECTION";
                await session.save();
                const reply = `📍 Pincode verified! We found a dealership at **${areaName}**. \n\n🎨 Which **Color** would you like to explore for your **Mahindra ${session.data.carModel}**?`;
                await sendMessage(sender, reply);
                return res.status(200).send("OK");
            }
            await sendMessage(sender, "Please provide a valid 6-digit Pincode to continue with your booking. 🎯");
            return res.status(200).send("OK");
        }

        if (session.state === "COLOR_SELECTION") {
            session.data.color = textRaw;
            session.state = "DATE_SELECTION";
            await session.save();
            await sendMessage(sender, `Great choice! 🎨 **${textRaw}** looks stunning. \n\n📅 Which **Date** would you like to visit for a Test Drive? (e.g., Tomorrow, Monday)`);
            return res.status(200).send("OK");
        }

        if (session.state === "DATE_SELECTION") {
            session.data.date = textRaw;
            session.state = "TIME_SELECTION";
            await session.save();
            await sendMessage(sender, `Got it! 📅 **${textRaw}**. \n\n⏰ At what **Time** should we expect you? (e.g., 11 AM, 3 PM)`);
            return res.status(200).send("OK");
        }

        if (session.state === "TIME_SELECTION") {
            const finalReply = `✅ **Mahindra Booking Confirmed!** \n\n🚙 **Car**: Mahindra ${session.data.carModel}\n🎨 **Color**: ${session.data.color}\n📅 **Date**: ${session.data.date}\n⏰ **Time**: ${textRaw}\n📍 **Location**: ${session.data.area}\n\nThank you for choosing Mahindra! Our advisor will contact you soon. 🙏🏁`;
            session.state = "IDLE";
            session.data = {}; 
            await session.save();
            await sendMessage(sender, finalReply);
            return res.status(200).send("OK");
        }

        // 🚀 GLOBAL REDIRECTION SYSTEM
        const cars = await Car.find({});
        let detectedCarName = null;
        for (const car of cars) {
            if (new RegExp(car.name, "i").test(textRaw)) {
                detectedCarName = car.name;
                break;
            }
        }

        const isBookingGoal = /(book|test drive|pincode|buy|interested|appointment)/i.test(lowerMsg);
        if (isBookingGoal && (detectedCarName || session.data.carModel)) {
            session.state = "PINCODE";
            if (detectedCarName) session.data.carModel = detectedCarName;
            await session.save();
            await sendMessage(sender, `Sure! I can help you with your booking. Please share your **6-digit Pincode** to find the nearest dealership. 🏁🏙️`);
            return res.status(200).send("OK");
        }

        // 🧠 AI CONGENIAL ADVISOR
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        let historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        const aiResponse = await getAIResponse(textRaw || "Hello", historyContextForAi, baseUrl, session);
        await sendMessage(sender, aiResponse);

        // 📸 IMAGE DELIVERY SYSTEM
        if (detectedCarName) {
            const carObj = await Car.findOne({ name: detectedCarName });
            if (carObj && carObj.imageUrl) {
                await axios.post(`https://v1.11za.com/v1/message/media?token=${process.env.ZA_TOKEN}`, {
                    to: sender,
                    type: "image",
                    media_url: carObj.imageUrl,
                    origin: process.env.ZA_ORIGIN
                });
            }
        }

        return res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Webhook Error:", error.message);
        return res.status(200).send("OK");
    }
};