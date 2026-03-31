import { sendMessage, sendInteractiveMessage, downloadMedia } from "../services/whatsappService.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import * as templates from "../utils/bookingTemplates.js";
import { connectDB } from "../config/db.js";
import { getDealerByPincode } from "../utils/dealerData.js";

export const handleWebhook = async (req, res) => {
    // 1. CRITICAL: Acknowledge 11za immediately to prevent timeout/crashes!
    if (!res.headersSent) res.status(200).send("OK");

    try {
        await connectDB();
        
        console.log("📩 Webhook Received Payload:", JSON.stringify(req.body, null, 2));

        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        const sender = req.body.from || msg.from || req.body.sender || val.contacts?.[0]?.wa_id;
        if (!sender) return;

        const interactive = msg.interactive || val.interactive || req.body.interactive || req.body.UserResponse;
        const type = msg.type || val.type || req.body.type || "text";
        
        // 2. PRIORITY: Audio/Media Tracking
        const isMedia = req.body.content?.contentType === "media" || type === "audio" || type === "voice";
        const mediaObj = req.body.content?.media || val.media || {};
        const potentialUrl = mediaObj.url || mediaObj.link || req.body.media_url || val.media_url;

        let message = null;

        if (isMedia || potentialUrl) {
            console.log(`[11ZA] Media detected from ${sender}. URL: ${potentialUrl}`);
            if (potentialUrl && potentialUrl.startsWith("http")) {
                await sendMessage(sender, "Listening to your voice note... 🎧");
                const audioBuffer = await downloadMedia(potentialUrl);
                if (audioBuffer) {
                    message = await transcribeAudio(audioBuffer);
                    console.log(`[11ZA] Transcribed: "${message}"`);
                    if (!message) {
                        await sendMessage(sender, "I couldn't hear that clearly. Can you try typing? 😊");
                        return;
                    }
                } else {
                    await sendMessage(sender, "Failed to download audio. Please try again! 😊");
                    return;
                }
            } else {
                return;
            }
        } else {
            message = req.body.content?.text || req.body.content?.body || (typeof req.body.content === 'string' ? req.body.content : null);
            if (typeof message === "object") message = message?.body || message?.text || null;
        }

        if (!message && !interactive && !isMedia) return;

        // 3. Main Session Logic
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE" }).save();

        const lowerMsg = message?.toLowerCase() || "";

        // --- Booking Keyword Intercept ---
        const bookingKeywords = ["book test drive", "book drive", "test drive karni h", "test drive book", "appointment for test drive", "test drive request", "book", "book please", "booking"];
        const carsList = [
            { keyword: "thar", name: "Thar" }, { keyword: "xuv700", name: "XUV700" }, { keyword: "scorpio-n", name: "Scorpio-N" },
            { keyword: "scorpio", name: "Scorpio-N" }, { keyword: "bolero neo", name: "Bolero Neo" }, { keyword: "bolero", name: "Bolero" },
            { keyword: "marazzo", name: "Marazzo" }
        ];

        if (bookingKeywords.some(k => lowerMsg.includes(k))) {
            const bookingData = session.data || {};
            const foundCar = carsList.find(c => lowerMsg.includes(c.keyword));
            if (foundCar) bookingData.carModel = foundCar.name;

            const colors = ["black", "white", "red", "grey", "silver", "gold", "blue"];
            for (const c of colors) if (lowerMsg.includes(c)) bookingData.color = c.charAt(0).toUpperCase() + c.slice(1);

            const fuels = ["petrol", "diesel"];
            for (const f of fuels) if (lowerMsg.includes(f)) bookingData.fuel = f.charAt(0).toUpperCase() + f.slice(1);

            session.data = bookingData;
            
            if (!bookingData.carModel) {
                session.state = "COLLECTING_CAR";
                await session.save();
                await sendMessage(sender, "Which Mahindra model would you like to book? (e.g., Thar, XUV700, Scorpio-N)");
                return;
            }

            if (!bookingData.color) {
                session.state = "COLLECTING_COLOR";
                await session.save();
                const car = await Car.findOne({ name: bookingData.carModel });
                if (car && templates.getColorList) {
                    await sendInteractiveMessage(sender, templates.getColorList(car.name, car.colors));
                } else {
                    await sendMessage(sender, `Which color would you like for your ${bookingData.carModel}?`);
                }
                return;
            }

            session.state = "COLLECTING_PINCODE";
            await session.save();
            await sendMessage(sender, `Awesome choice! A ${bookingData.color} ${bookingData.carModel}. 🚀\n\nPlease share your 6-digit pin code to find the nearest showroom.`);
            return;
        }

        // --- Interactive Click Handler ---
        if (interactive) {
            const replyId = interactive?.button_reply?.id || interactive?.list_reply?.id;
            const replyTitle = interactive?.button_reply?.title || interactive?.list_reply?.title;
            
            if (replyId === "action_book_test_drive") {
                session.state = "COLLECTING_PINCODE";
                await session.save();
                await sendMessage(sender, "Great! Please share your 6-digit pin code (e.g., 400069) to find the nearest showroom. 📍");
                return;
            }

            if (replyId?.startsWith("color_")) {
                session.state = "COLLECTING_FUEL";
                if (!session.data) session.data = {};
                session.data.color = replyTitle;
                const car = await Car.findOne({ name: { $regex: new RegExp(session.data.carModel || "", "i") } });
                if (car && car.fuelType) {
                    await session.save();
                    await sendInteractiveMessage(sender, templates.getFuelList(car.name, car.fuelType));
                } else {
                    session.state = "COLLECTING_DATE";
                    await session.save();
                    await sendInteractiveMessage(sender, templates.getDateList());
                }
                return;
            }

            if (replyId?.startsWith("fuel_")) {
                session.state = "COLLECTING_DATE";
                if (!session.data) session.data = {};
                session.data.fuel = replyTitle;
                await session.save();
                const shortBaseUrl = baseUrl.replace(/^https?:\/\//, "");
                await sendMessage(sender, `📅 *Open Calendar*: ${shortBaseUrl}/booking/calendar`);
                await sendInteractiveMessage(sender, templates.getDateList());
                return;
            }

            if (replyId?.startsWith("date_")) {
                session.state = "COLLECTING_TIME";
                if (!session.data) session.data = {};
                session.data.date = replyTitle;
                await session.save();
                await sendInteractiveMessage(sender, templates.getSlotList(replyTitle));
                return;
            }

            if (replyId?.startsWith("slot_")) {
                session.state = "IDLE";
                if (!session.data) session.data = {};
                session.data.time = replyTitle;
                await session.save();
                const summary = `🚗 Car: ${session.data.carModel}\n🎨 Color: ${session.data.color}\n⛽ Fuel: ${session.data.fuel}\n📍 Pincode: ${session.data.pincode}\n📅 Date: ${session.data.date}\n⏰ Time: ${replyTitle}`;
                await sendMessage(sender, `Perfect! 🎉 Summary:\n${summary}\n\nA representative will call you soon! 🏁`);
                return;
            }
        }

        // --- Pincode Flow ---
        if (session.state === "COLLECTING_PINCODE") {
            const pincode = message?.replace(/\D/g, "");
            if (pincode && /^[1-9][0-9]{5}$/.test(pincode)) {
                if (!session.data) session.data = {};
                session.data.pincode = pincode;
                
                if (!session.data.carModel) {
                    session.state = "COLLECTING_CAR";
                    await session.save();
                    await sendMessage(sender, "Which Mahindra model would you like to book? 🏎️");
                } else {
                    session.state = "COLLECTING_DATE";
                    await session.save();
                    const dealer = getDealerByPincode(pincode);
                    const dealerMsg = dealer ? `\n📌 Showroom: ${dealer.name}\n📍 ${dealer.address}` : "";
                    const shortBaseUrl = baseUrl.replace(/^https?:\/\//, "");
                    await sendMessage(sender, `Perfect! What day should I block?${dealerMsg}\n\n📅 Calendar: ${shortBaseUrl}/booking/calendar`);
                    await sendInteractiveMessage(sender, templates.getDateList());
                }
                return;
            } else {
                await sendMessage(sender, "Oops! Please enter a valid 6-digit pincode. 📍");
                return;
            }
        }

        // --- AI Response Fallback ---
        const historyForAi = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContextForAi = historyForAi.reverse().map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");
        
        const aiResponse = await getAIResponse(message, historyContextForAi, baseUrl);
        
        await new Chat({ sender, content: message, reply: aiResponse, role: "user" }).save();
        await sendMessage(sender, aiResponse);

    } catch (err) {
        console.error("❌ Webhook Error:", err.message);
    }
};

export const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token === process.env.VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
    }
    res.status(200).send("Webhook active");
};