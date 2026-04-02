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
        
        // 🛠️ SERVERLESS DB HYDRATION: Ensure connection is alive before any Mongoose calls
        const { connectDB } = await import("../config/db.js");
        await connectDB();

        const body = req.body;
        console.log("📦 BODY:", JSON.stringify(body, null, 2));

        let sender, type, textRaw = "";

        // 1️⃣ Custom 11za format
        if (body.from && body.content) {
            sender = body.from;
            type = body.content.contentType || "text";
            if (type === "text") {
                textRaw = body.content.text || "";
            } else if (type === "audio") {
                // If it's a media pointer in 11za's format
                const mediaId = body.content.mediaId || body.messageId; 
                // We'll handle this media below using the universal downloader
            }
        }
        // 2️⃣ Standard Meta Cloud API format
        else if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            sender = msgObj.from;
            type = msgObj.type;
            if (type === "text") textRaw = msgObj.text.body;
            else if (type === "audio") textRaw = ""; // Will be processed below
        }
        // 3️⃣ Direct body.messages format (legacy)
        else if (body.messages && body.messages[0]) {
            sender = body.messages[0].from;
            type = body.messages[0].type;
            textRaw = type === "text" ? body.messages[0].text.body : "";
        }

        if (!sender) {
            console.log("⚠️ No sender or message content found in any supported format.");
            return res.status(200).send("OK");
        }

        console.log(`📨 Message from ${sender} (Type: ${type}) | Text: ${textRaw}`);

        // 🎤 Audio Processing
        if (type === "audio") {
            try {
                // Determine mediaId based on format
                let mediaId = "";
                if (body.content && body.content.mediaId) mediaId = body.content.mediaId;
                else if (body.messages && body.messages[0].audio) mediaId = body.messages[0].audio.id;
                else if (body.entry && body.entry[0].changes[0].value.messages[0].audio) mediaId = body.entry[0].changes[0].value.messages[0].audio.id;

                if (mediaId) {
                    const mediaUrl = `https://v1.11za.com/v1/media/${mediaId}`;
                    console.log(`🎤 Downloading audio from ${mediaUrl}...`);
                    const response = await axios.get(mediaUrl, {
                        headers: { 'Authorization': `Bearer ${process.env.ZA_TOKEN}` },
                        responseType: 'arraybuffer'
                    });
                    textRaw = await transcribeAudio(Buffer.from(response.data));
                    console.log("🎤 Audio Transcribed:", textRaw);
                }
            } catch (err) {
                console.error("❌ Audio Transcription Failed:", err.message);
            }
        }

        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [] } });
            await session.save();
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase() : "";
        
        // 🔄 SESSION RESET
        if (["reset", "restart", "start over", "cancel"].includes(lowerMsg)) {
            session.state = "IDLE";
            session.data = {};
            await session.save();
            await sendMessage(sender, "✅ Session Reset! How can I assist you today?");
            return res.status(200).send("OK");
        }

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
        const greetings = ["hi", "hello", "hyy", "helo", "yo", "namaste", "hey", "hii", "hy"];
        if (greetings.includes(lowerMsg)) {
            console.log("👋 Greeting detected. Resetting to Fresh Welcome.");
            session.state = "IDLE";
            session.data = {};
            await session.save();
            
            const greetingDirective = containsDevanagari 
                ? "महिंद्रा में आपका स्वागत है। आज हम आपकी सहायता कैसे कर सकते हैं?" 
                : "Welcome to Mahindra. How can I assist you with our powerful SUV lineup today?";
            
            await sendMessage(sender, greetingDirective);
            return res.status(200).send("OK");
        } 
        
        // 📍 PINCODE STEP (Realistic Dealer Lookup)
        else if (session.state === "PINCODE") {
            const pincodeVal = textRaw.match(/\d{6}/);
            if (pincodeVal) {
                const pc = pincodeVal[0];
                session.data.pincode = pc;
                
                // Demo Database
                const DEALERS = {
                    "400001": "Mahindra Sterling, South Mumbai",
                    "395007": "Mahindra NBS International, Surat",
                    "110001": "Mahindra Koncept Motors, Delhi",
                    "411001": "Sahyadri Mahindra, Pune",
                    "400064": "Mahindra Provincial-Liberty, Malad"
                };
                
                const areaName = DEALERS[pc] || "Our nearest Authorized Dealership in your region"; 
                session.data.area = areaName;
                session.state = "COLOR_SELECTION";
                await session.save();
                
                const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `Pincode ${pc} verified. Dealership: ${areaName}. Appreciate and ask for their preferred Color for Mahindra ${session.data.carModel}. EXTREMELY BRIEF.`);
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
            const summaryData = `*Car*: ${session.data.carModel}\n*Color*: ${session.data.color}\n*Date*: ${session.data.date}\n*Time*: ${textRaw}\n*Location*: ${session.data.area}`;
            const aiResponse = await getAIResponse(textRaw, historyContextForAi, baseUrl, session, `FINAL SUMMARY. Provide a VERY BRIEF confirmation (max 2 sentences) in user's language and show this summary: ${summaryData}`);
            
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