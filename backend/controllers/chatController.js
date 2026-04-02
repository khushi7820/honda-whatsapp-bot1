// Version 1.1.63 - Ultimate Names Only & Absolute Bypass
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
        let mId = msgId;

        if (body.from && body.content) {
            sender = body.from;
            type = body.content.contentType?.toLowerCase() || "text";
            if (body.content.mediaId) mId = body.content.mediaId;
            textRaw = body.content.text || "";
        } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            sender = msgObj.from;
            type = msgObj.type?.toLowerCase() || "text";
            mId = msgObj.audio?.id || msgObj.voice?.id || msgId;
            if (type === "text") textRaw = msgObj.text.body || "";
        } else if (body.messages?.[0]) {
            sender = body.messages[0].from;
            type = body.messages[0].type?.toLowerCase() || (body.messages[0].isAudio ? "audio" : "text");
            mId = body.messages[0].audio?.id || body.messages[0].voice?.id || msgId;
            textRaw = type === "text" ? (body.messages[0].text?.body || "") : "";
        }

        if (!sender) return res.status(200).send("OK");

        if (type !== "text") {
            try {
                const buffer = await downloadMedia(`https://v1.11za.com/v1/media/${mId}`);
                if (buffer) textRaw = await transcribeAudio(buffer) || "(Audio Empty)";
            } catch (err) { textRaw = "(Transcription Error)"; }
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";
        console.log(`[BOT] User Input: "${textRaw}" from ${sender}`);

        // 0. GREETINGS BYPASS
        const greetings = ["hi", "hello", "namaste", "hey", "hii", "hy", "naam"];
        if (greetings.some(g => lowerMsg.includes(g))) {
            const welcomeMsg = /hindi|bhai|kya|batao|ka|se|hai|hu|ans|kaisa|aayega|swagat|apna/i.test(lowerMsg)
                ? "*Namaste, Mahindra Virtual Showroom mein aapka swagat hai!* 🚗✨"
                : "Hi, how can I help you with our Mahindra SUVs today? 🚗✨";
            await sendMessage(sender, welcomeMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: welcomeMsg, content: welcomeMsg }).save();
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

            const successMsg = `*Booking Confirmed* ✅\n\n• Car: ${carName}\n• Pincode: ${pc}\n• Location: ${city}\n• Date: ${date}\n• Time: ${time}\n\nThank you for choosing Mahindra! ✨`;
            await sendMessage(sender, successMsg);

            // 👑 Notify Admin (+15558689519)
            const adminMsg = `*New Mahindra Lead* 🚨\n\n• Customer: ${sender}\n• Car: ${carName}\n• Pincode: ${pc}\n• Location: ${city}\n• Date: ${date}\n• Time: ${time}`;
            await sendMessage("15558689519", adminMsg);

            if (session) { session.state = "IDLE"; await session.save(); }
            return res.status(200).send("OK");
        }

        // 1. ABSOLUTE TOP BYPASS: CAR LISTS (NAMES ONLY)
        const isListQuery = /list|models|options|available|lineup|all suv|show cars|tell me cars|cars/i.test(lowerMsg);
        if (isListQuery) {
            const namesOnlyList = `*Mahindra SUV Models* 🚗✨\n\n• Scorpio N \n• Thar \n• XUV700 \n• Bolero Neo \n• XUV 3XO \n• Bolero \n• XUV400 EV \n• Marazzo \n\n👉 Which one are you interested in?`;
            console.log("-----------------------------------------");
            console.log("[STRICT BYPASS] Car List Requested. Sending NAMES ONLY.");
            console.log("-----------------------------------------");
            await sendMessage(sender, namesOnlyList);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: namesOnlyList, content: namesOnlyList }).save();
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
                const calLink = `https://honda-whatsapp-bot1-paje.vercel.app/booking/calendar?carId=${carSlug}&phone=${sender}`;
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
            if (lowerMsg.includes(shortName)) {
                detectedCar = car.name;
                break;
            }
        }

        if (detectedCar) {
            session.data.carModel = detectedCar;
            await session.save();
        }

        const isBooking = /(book|buy|interested|appointment|booking|chalana|dekhna)/i.test(lowerMsg);
        const isDetailQuery = /detail|show|info|specs|price|mileage|image|photo|pic/i.test(lowerMsg);

        // 4. DETAIL & BOOKING BYPASS (IMAG + 4-LINE FORMAT)
        if ((isBooking || isDetailQuery || (detectedCar && lowerMsg.length < 20)) && (detectedCar || session.data.carModel)) {
            const carName = detectedCar || session.data.carModel;
            const carObj = await Car.findOne({ name: carName });
            
            if (carObj) {
                session.state = "PINCODE";
                await session.save();

                const detailText = `*${carObj.name}* 🚗\n\n` +
                    `💰 *Price:* ${carObj.price || "Contact Dealership"}\n` +
                    `🎨 *Colors:* ${carObj.colors ? carObj.colors.join(", ") : "Premium Colors"}\n` +
                    `⛽ *Fuel:* ${carObj.fuelType || "Petrol/Diesel"}\n` +
                    `📊 *Mileage:* ${carObj.mileage || "Standard"}\n\n` +
                    `👉 *Please share your 6-digit Pincode to book a test drive.*`;

                if (carObj.imageUrl) {
                    await sendImage(sender, carObj.imageUrl, detailText);
                } else {
                    await sendMessage(sender, detailText);
                }

                await new Chat({ sender, role: "user", content: textRaw }).save();
                await new Chat({ sender, role: "assistant", reply: detailText, content: detailText }).save();
                return res.status(200).send("OK");
            }
        }

        if (isDetailQuery) {
            const carName = detectedCar || session.data.carModel || "XUV700";
            const carObj = await Car.findOne({ name: carName });
            const galleryLink = `https://honda-whatsapp-bot1-paje.vercel.app/gallery/${carName.toLowerCase().replace(/\s+/g, "-")}`;
            const imgMsg = `*Virtual Showroom* ✨🚗\n\nExplore all images of the *${carName}* here:\n🔗 ${galleryLink}`;
            if (carObj?.imageUrl) await sendImage(sender, carObj.imageUrl, imgMsg);
            else await sendMessage(sender, imgMsg);
            return res.status(200).send("OK");
        }

        // 5. AI FALLBACK
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