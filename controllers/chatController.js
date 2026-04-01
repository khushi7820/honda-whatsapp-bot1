// Build Force: 2026-04-01T11:43:00Z - Fixed Export Issue
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage, sendImage } from "../services/whatsappService.js";
import axios from "axios";

export async function handleWebhook(req, res) {
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

        // 🧠 AI CONTEXT (Moving up for global use)
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        // 🔗 WEB-TO-WHATSAPP FINALIZATION
        if (textRaw && textRaw.startsWith("CONFIRM_BOOKING:")) {
            const dataParts = textRaw.replace("CONFIRM_BOOKING:", "").split("|");
            const dateStr = dataParts[0] || "Upcoming";
            const timeStr = dataParts[1] || "Flexible";
            
            const confirmedReply = `✅ **Mahindra Booking Finalized!** \n\n🏁 **Status**: Confirmed on Web \n🚙 **Car**: Mahindra ${session.data.carModel || "SUV"}\n📅 **Date**: ${dateStr}\n⏰ **Time**: ${timeStr}\n📍 **Location**: Mahindra Authorized Dealer\n\nThank you for choosing Mahindra! Our sales advisor will reach out shortly to finalize the paperwork. 🙏🏁`;
            
            session.state = "IDLE";
            session.data = {};
            await session.save();
            await sendMessage(sender, confirmedReply);
            return res.status(200).send("OK");
        }

        // 🚀 INITIAL GREETING - Fall through to AI for Mirroring
        const greetings = ["hi", "hello", "hyy", "helo", "yo", "namaste", "hey", "hii"];
        if (greetings.includes(lowerMsg) && session.state === "IDLE") {
            console.log("👋 Greeting detected. Flowing to AI for premium mirrored response.");
        } 
        
        // 🏁 SALES FUNNEL: PINCODE -> COLOR -> DATE -> TIME -> SUMMARY
        else if (session.state === "PINCODE") {
            const pincodeVal = textRaw.match(/\d{6}/);
            if (pincodeVal) {
                session.data.pincode = pincodeVal[0];
                const areaName = "Mahindra City Store, Mumbai"; 
                session.data.area = areaName;
                session.state = "COLOR_SELECTION";
                await session.save();
                
                const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `Pincode ${pincodeVal[0]} verified at ${areaName}. Warmly acknowledge and ask for their preferred Color for Mahindra ${session.data.carModel}. Stay premium.`);
                await sendMessage(sender, aiResponse);
                return res.status(200).send("OK");
            }
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, "The user provided an invalid pincode. Politely ask for a valid 6-digit Pincode to verify dealership availability.");
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        else if (session.state === "COLOR_SELECTION") {
            session.data.color = textRaw;
            session.state = "DATE_SELECTION";
            await session.save();
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `The user selected ${textRaw} color. Appreciate the choice and ask for a Date for the Test Drive visit.`);
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        else if (session.state === "DATE_SELECTION") {
            session.data.date = textRaw;
            session.state = "TIME_SELECTION";
            await session.save();
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `Date ${textRaw} noted. Now ask for a specific Time for the appointment.`);
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        else if (session.state === "TIME_SELECTION") {
            const summaryData = `Car: Mahindra ${session.data.carModel}, Color: ${session.data.color}, Date: ${session.data.date}, Time: ${textRaw}, Location: ${session.data.area}`;
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `BOOKING COMPLETE. Generate a final summary in a premium format with these details: ${summaryData}. Use the user's language and script.`);
            
            session.state = "IDLE";
            session.data = {}; 
            await session.save();
            await sendMessage(sender, aiResponse);
            return res.status(200).send("OK");
        }

        // 🚀 GLOBAL REDIRECTION & AI
        const cars = await Car.find({});
        let detectedCarName = null;
        for (const car of cars) {
            if (new RegExp(car.name, "i").test(textRaw)) {
                detectedCarName = car.name;
                break;
            }
        }

        const isBookingGoal = /(book|test drive|pincode|buy|interested|appointment|booking|chalana|dekhna)/i.test(lowerMsg);
        if (isBookingGoal && (detectedCarName || session.data.carModel)) {
            session.state = "PINCODE";
            if (detectedCarName) session.data.carModel = detectedCarName;
            await session.save();
            const aiResponse = await getAIResponse(textRaw || "I'm interested", historyContextForAi, baseUrl, session, `User is interested in booking/test drive for Mahindra ${session.data.carModel || "SUV"}. Enthusiastically accept and ask for their 6-digit Pincode to locate the nearest dealership. STRICTLY no links.`);
            await sendMessage(sender, aiResponse);
            
            // Save Chat History
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: aiResponse }).save();
            return res.status(200).send("OK");
        }

        // 🧠 AI CONGENIAL ADVISOR
        const aiResponse = await getAIResponse(textRaw || "Hello", historyContextForAi, baseUrl, session);
        await sendMessage(sender, aiResponse);

        // Save Chat History
        const newChat = new Chat({ sender, role: "user", content: textRaw });
        await newChat.save();
        const aiChat = new Chat({ sender, role: "assistant", reply: aiResponse });
        await aiChat.save();

        // 📸 IMAGE DELIVERY SYSTEM
        if (detectedCarName) {
            const carObj = await Car.findOne({ name: detectedCarName });
            if (carObj) {
                const imageToSend = carObj.imageUrl || (carObj.images && carObj.images.length > 0 ? carObj.images[0] : null);
                if (imageToSend) {
                    const caption = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `Generate a short (5-10 words), exciting caption for an image of the Mahindra ${detectedCarName}. MUST BE in the user's language/script.`);
                    await sendImage(sender, imageToSend, caption);
                }
            }
        }

        return res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Webhook Error:", error.message);
        return res.status(200).send("OK");
    }
}

export function verifyWebhook(req, res) {
    console.log("🔍 Verifying Webhook...");
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
}