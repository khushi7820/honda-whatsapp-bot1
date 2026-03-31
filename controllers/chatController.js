import { sendMessage, sendInteractiveMessage, downloadMedia } from "../services/whatsappService.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import * as templates from "../utils/bookingTemplates.js";
import { connectDB } from "../config/db.js";
import { getDealerByPincode } from "../utils/dealerData.js";

export const handleWebhook = async (req, res) => {
    try {
        console.log("📩 Webhook Received Payload:", JSON.stringify(req.body, null, 2));
        // --- Multi-format Extraction (Flat and Nested Support) ---
        const entry = req.body?.entry?.[0];
        const val = entry?.changes?.[0]?.value || req.body;
        const msg = val?.messages?.[0] || req.body;
        
        // Sender: can be in 'from', 'sender', or 'wa_id'
        let sender = msg.from || req.body.sender || req.body.from || val.contacts?.[0]?.wa_id;

        // Message content: support flat 11za/Waba format and nested Meta format
        let type = msg.type || val.type || req.body.type || "text";
        let message = 
            req.body.content || 
            req.body.UserResponse || 
            msg.text?.body || 
            msg.text || 
            msg.body || 
            val.text?.body || 
            null;

        // Clean up: if content is an object (common in some 11za versions), grab the body
        if (typeof message === "object") message = message?.body || message?.text || message?.content || null;

        // Interactive support (Buttons/Lists)
        let interactive = msg.interactive || val.interactive || req.body.interactive || req.body.UserResponse;

        if (!sender) {
            return res.status(200).send("No sender data");
        }

        // IMPORTANT: Await DB connection (Serverless Cold Start Ready)
        try {
            await connectDB();
        } catch (dbErr) {
            console.error("❌ Database connection failed:", dbErr.message);
            return res.status(200).send("DB connection error");
        }

        if (!message && !interactive) {
            // "11ZA Media Detection" (Pattern matched with D:\11za_bot)
            const isMedia = req.body.content?.contentType === "media";
            const mediaObj = req.body.content?.media || {};
            const potentialUrl = mediaObj.url || mediaObj.link || req.body.media_url || val.media_url;

            if (isMedia || type === "audio" || type === "voice" || potentialUrl) {
                console.log(`[11ZA MEDIA DETECTION] Triggered! URL: ${potentialUrl}`);
                
                // CRITICAL: Send 200 OK immediately for audio to prevent timeout
                res.status(200).send("OK");

                if (potentialUrl && potentialUrl.startsWith("http")) {
                    await sendMessage(sender, "Listening to your voice note... 🎧");
                    
                    const audioBuffer = await downloadMedia(potentialUrl);
                    if (audioBuffer) {
                        message = await transcribeAudio(audioBuffer);
                        console.log(`[11ZA Transcribed]: ${message}`);
                        
                        // Continue to standard AI processing with transcribed message
                        if (!message) return; // Exit if transcription failed
                    } else {
                        return sendMessage(sender, "I couldn't download the audio. Please try again! 😊");
                    }
                } else {
                    return sendMessage(sender, "I couldn't process this voice note format. Please try typing! 😊");
                }
            } else {
                return res.status(200).send("No message mapping found");
            }
        } else {
             // For text/interactive, we send 200 later or now
             res.status(200).send("OK");
        }

        // 1. Get/Create Session
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE" }).save();

        console.log(`Msg from ${sender} [State: ${session.state}]: ${message || "Interactive"}`);

        const lowerMsg = message?.toLowerCase() || "";

        // 1. Intercept Direct Booking Intent (Before AI)
        const bookingKeywords = ["book test drive", "book drive", "test drive karni h", "test drive book", "appointment for test drive", "test drive request", "book", "book please", "booking"];
        
        const carsList = [
            { keyword: "thar", name: "Thar" },
            { keyword: "xuv700", name: "XUV700" },
            { keyword: "xuv 700", name: "XUV700" },
            { keyword: "scorpio-n", name: "Scorpio-N" },
            { keyword: "scorpio n", name: "Scorpio-N" },
            { keyword: "scorpio", name: "Scorpio-N" },
            { keyword: "bolero neo", name: "Bolero Neo" },
            { keyword: "bolero neo", name: "Bolero Neo" },
            { keyword: "bolero classic", name: "Bolero" },
            { keyword: "bolero", name: "Bolero" },
            { keyword: "marazzo", name: "Marazzo" }
        ];

        if (bookingKeywords.some(k => lowerMsg.includes(k))) {
            session.state = "COLLECTING_PINCODE";
            
            const foundCar = carsList.find(c => lowerMsg.includes(c.keyword));
            if (foundCar) {
                if (!session.data) session.data = {};
                session.data.carModel = foundCar.name;
            }

            await session.save();
                await sendMessage(sender, "Great! To find the nearest Mahindra showroom and plan your test drive, please share your 6-digit pin code (e.g., 400069). 📍");
            return res.status(200).send("OK");
        }

        // 2. Handle Interactive Replies (Button/List clicks)
        if (interactive) {
            const replyId = interactive?.button_reply?.id || interactive?.list_reply?.id;
            const replyTitle = interactive?.button_reply?.title || interactive?.list_reply?.title;
            
            if (replyId === "action_book_test_drive") {
                session.state = "COLLECTING_PINCODE";
                await session.save();
                    await sendMessage(sender, "Great! To find the nearest Mahindra showroom and plan your test drive, please share your 6-digit pin code (e.g., 400069). 📍");
                return res.status(200).send("OK");
            }

            if (replyId?.startsWith("color_")) {
                session.state = "COLLECTING_FUEL";
                if (!session.data) session.data = {};
                session.data.color = replyTitle;
                
                const car = await Car.findOne({ name: { $regex: new RegExp(session.data.carModel || "", "i") } });
                if (car && car.fuelType) {
                    await session.save();
                    await sendInteractiveMessage(sender, templates.getFuelList(car.name, car.fuelType));
                    return res.status(200).send("OK");
                }
                
                session.state = "COLLECTING_DATE";
                await session.save();
                await sendInteractiveMessage(sender, templates.getDateList());
                return res.status(200).send("OK");
            }

            if (replyId?.startsWith("fuel_")) {
                session.state = "COLLECTING_DATE";
                if (!session.data) session.data = {};
                session.data.fuel = replyTitle;
                await session.save();
                
                const shortBaseUrl = baseUrl.replace(/^https?:\/\//, "");
                await sendMessage(sender, `Great choice! What day should I block for your test drive?\n\n📅 *Open Calendar*: ${shortBaseUrl}/booking/calendar`);
                await sendInteractiveMessage(sender, templates.getDateList());
                return res.status(200).send("OK");
            }

            if (replyId?.startsWith("date_")) {
                const date = replyTitle;
                session.state = "COLLECTING_TIME";
                if (!session.data) session.data = {};
                session.data.date = date;
                await session.save();
                
                await sendInteractiveMessage(sender, templates.getSlotList(date));
                return res.status(200).send("OK");
            }

            if (replyId?.startsWith("slot_")) {
                const time = replyTitle;
                session.state = "IDLE";
                if (!session.data) session.data = {};
                session.data.time = time;
                await session.save();

                const carMsg = session.data.carModel ? `\n🚗 *Selected Car*: ${session.data.carModel}` : "";
                const colorMsg = session.data.color ? `\n🎨 *Color*: ${session.data.color}` : "";
                const fuelMsg = session.data.fuel ? `\n⛽ *Fuel*: ${session.data.fuel}` : "";
                const pinMsg = session.data.pincode ? `\n📍 *Pincode*: ${session.data.pincode}` : "";
                const dateMsg = session.data.date ? `\n📅 *Date*: ${session.data.date}` : "";
                
                await sendMessage(sender, `Perfect! 🎉 Here is your Summary:\n${carMsg}${colorMsg}${fuelMsg}${pinMsg}${dateMsg}\n⏰ *Time*: ${time}\n\nA Mahindra representative from your nearest dealership will call you for final confirmation. 🏁\n\nThank you for booking with us! 🙌 Is there anything else you'd like to know or check out? I'm here to help!\n\nView our catalog anytime: ${baseUrl}/gallery/general`);
                return res.status(200).send("OK");
            }
        }

        // 3. Handle Flow States (Pincode -> Date)
        if (session.state === "COLLECTING_PINCODE") {
            const pincode = message?.replace(/\D/g, "");
            // Valid Indian Pincode: 6 digits, doesn't start with 0
            if (pincode && /^[1-9][0-9]{5}$/.test(pincode)) {
                session.state = "COLLECTING_DATE";
                if (!session.data) session.data = {};
                session.data.pincode = pincode;
                
                // Try to find if user talked about a specific car recently
                if (!session.data.carModel) {
                    const historyForCar = await Chat.findOne({ sender, content: /thar|xuv|scorpio|bolero|marazzo/i }).sort({ timestamp: -1 });
                    if (historyForCar) {
                        const historyLower = historyForCar.content.toLowerCase();
                        const foundInHistory = carsList.find(c => historyLower.includes(c.keyword));
                        if(foundInHistory) session.data.carModel = foundInHistory.name;
                    }
                }
                
                // Intercept and ask color if CarModel is known
                if (session.data.carModel) {
                    const car = await Car.findOne({ name: { $regex: new RegExp(session.data.carModel, "i") } });
                    if (car && car.colors && car.colors.length > 0) {
                        session.state = "COLLECTING_COLOR";
                        await session.save();
                        await sendInteractiveMessage(sender, templates.getColorList(car.name, car.colors));
                        return res.status(200).send("OK");
                    }
                }

                session.state = "COLLECTING_DATE";
                await session.save();
                
                // Dealer Search Logic inside Pincode Flow
                const dealer = getDealerByPincode(pincode);
                const dealerMsg = dealer ? `\n\n📌 *Nearest Showroom Found!*: \n🏠 *${dealer.name}* \n📍 ${dealer.address} \n📞 Call: ${dealer.phone}` : "";
                
                // Keep Calendar as clean short text since 11za rejects cta_url
                const shortBaseUrl = baseUrl.replace(/^https?:\/\//, "");
                await sendMessage(sender, `What day should I block for your test drive?${dealerMsg}\n\n📅 *Open Calendar*: ${shortBaseUrl}/booking/calendar`);
                await sendInteractiveMessage(sender, templates.getDateList());
                return res.status(200).send("OK");
            } else {
                await sendMessage(sender, "Oops! That doesn't look like a valid Indian pin code. Please enter a valid *6-digit* pincode (e.g., 400069). 📍");
                return res.status(200).send("OK");
            }
        }

        if (session.state === "COLLECTING_DATE") {
            const chosenDate = message || "your selected date";
            session.state = "COLLECTING_TIME";
            if (!session.data) session.data = {};
            session.data.date = chosenDate;
            await session.save();
            
            await sendMessage(sender, `Great! You've selected ${chosenDate}.`);
            await sendInteractiveMessage(sender, templates.getSlotList(chosenDate));
            return res.status(200).send("OK");
        }

        if (session.state === "COLLECTING_TIME") {
            const chosenTime = message || "your selected time";
            session.state = "IDLE";
            if (!session.data) session.data = {};
            session.data.time = chosenTime;
            await session.save();
            
            const carMsg = session.data.carModel ? `\n🚗 *Selected Car*: ${session.data.carModel}` : "";
            const colorMsg = session.data.color ? `\n🎨 *Color*: ${session.data.color}` : "";
            const fuelMsg = session.data.fuel ? `\n⛽ *Fuel*: ${session.data.fuel}` : "";
            const pinMsg = session.data.pincode ? `\n📍 *Pincode*: ${session.data.pincode}` : "";
            const dateMsg = session.data.date ? `\n📅 *Date*: ${session.data.date}` : "";
            
            await sendMessage(sender, `Perfect! 🎉 Here is your Summary:\n${carMsg}${colorMsg}${fuelMsg}${pinMsg}${dateMsg}\n⏰ *Time*: ${chosenTime}\n\nA Mahindra representative from your nearest dealership will call you for final confirmation. 🏁\n\nThank you for booking with us! 🙌 Is there anything else you'd like to know or check out? I'm here to help!\n\nView our catalog anytime: ${baseUrl}/gallery/general`);
            return res.status(200).send("OK");
        }

        // 4. Default: Get AI Response
        const history = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContext = history.reverse().map(c => `${c.role}: ${c.content}`).join("\n");

        const aiResponse = await getAIResponse(message, historyContext, baseUrl);

        // Send the AI's response (now includes https:// for rich link previews)
        await sendMessage(sender, aiResponse);

        // Check for AI intent triggers for Test Drive
        const lowerRes = aiResponse.toLowerCase();
        if (lowerRes.includes("book test drive") || lowerRes.includes("hands-on drive")) {
            await sendInteractiveMessage(sender, templates.getBookButton("Ready to test drive? Tap 'Book Test Drive' to get started!"));
        }

        // 5. Save history
        if (message && aiResponse) {
            await new Chat({ sender, role: "user", content: message }).save();
            await new Chat({ sender, role: "assistant", content: aiResponse }).save();
        }

        res.status(200).send("Processed");
    } catch (error) {
        console.error("Webhook Error Details:", {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        // Still return 200 to acknowledge the webhook and prevent retries from 11za
        res.status(200).send("Processed with errors");
    }
};

export const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    
    // Default 11za check
    res.status(200).send("Webhook active");
};