import { sendMessage, sendInteractiveMessage } from "../services/whatsappService.js";
import { getAIResponse } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import * as templates from "../utils/bookingTemplates.js";
import { connectDB } from "../config/db.js";

export const handleWebhook = async (req, res) => {
    try {
        console.log("--- New Webhook Request ---");
        console.log("Headers:", JSON.stringify(req.headers, null, 2));
        console.log("Body:", JSON.stringify(req.body, null, 2));

        // IMPORTANT: Await DB connection before ANY mongo operation in Serverless
        await connectDB();

        // --- Parse 11za / Meta-style webhook body ---
        let sender, message, type, interactive;

        // Format 1: 11za/Meta Cloud API format (entry > changes > value > messages)
        const entry = req.body?.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const msgObj = value?.messages?.[0];

        if (msgObj) {
            sender = msgObj.from;
            type = msgObj.type;
            if (type === "text") {
                message = msgObj.text?.body;
            } else if (type === "interactive") {
                interactive = msgObj.interactive;
            } else if (type === "audio") {
                message = "[audio message]";
            } else {
                message = msgObj.text?.body || "[unsupported message type]";
            }
        } else {
            // Format 2: Flat format (our test format / older 11za format)
            sender = req.body.sender || req.body.from;
            message = req.body.message;
            type = req.body.type;
            interactive = req.body.interactive;
        }

        console.log(`[Parsed] sender=${sender}, type=${type}, message=${message}`);

        if (!sender) {
            console.log("⚠️ No sender found in request body.");
            return res.status(200).send("No sender data");
        }

        if (!message && !interactive) {
            console.log("⚠️ No message or interactive content found.");
            return res.status(200).send("No message data");
        }

        // 1. Get/Create Session
        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender }).save();

        console.log(`Msg from ${sender} [State: ${session.state}]: ${message || "Interactive Reply"}`);

        // 2. Handle Interactive Replies (Button/List clicks)
        if (type === "interactive" || interactive) {
            const replyId = interactive?.button_reply?.id || interactive?.list_reply?.id;
            
            if (replyId === "action_book_test_drive") {
                session.state = "COLLECTING_PINCODE";
                await session.save();
                await sendMessage(sender, "Absolutely! Mind sharing your pincode? For example, 400069 😊");
                return res.status(200).send("OK");
            }

            if (replyId?.startsWith("slot_")) {
                const slot = interactive.list_reply.title;
                session.data.slot = slot;
                session.state = "IDLE";
                await session.save();
                
                const bookingId = `TDBK${Math.floor(100000 + Math.random() * 900000)}`;
                await sendMessage(sender, `Your test drive has been successfully booked for ${session.data.date || "tomorrow"} at ${slot}! \n\nBooking Id: ${bookingId} \n\nMahindra Representative will call you shortly to confirm. 🎉`);
                return res.status(200).send("OK");
            }
        }

        // 3. Handle Flow States
        if (session.state === "COLLECTING_PINCODE") {
            const pincode = message?.trim();
            if (/^\d{6}$/.test(pincode)) {
                session.data.pincode = pincode;
                session.state = "COLLECTING_DATE";
                await session.save();
                await sendMessage(sender, "Got it! What day should I block for your test drive? (e.g., Tomorrow, 12th March)");
                return res.status(200).send("OK");
            } else {
                await sendMessage(sender, "Please enter a valid 6-digit pincode.");
                return res.status(200).send("OK");
            }
        }

        if (session.state === "COLLECTING_DATE") {
            session.data.date = message;
            session.state = "COLLECTING_SLOT";
            await session.save();
            await sendInteractiveMessage(sender, templates.getSlotList(message));
            return res.status(200).send("OK");
        }

        // 4. Default AI Response (Persona handling)
        const history = await Chat.find({ sender }).sort({ timestamp: 1 }).limit(10);
        const historyContext = history.map(chat => `${chat.role}: ${chat.content}`).join("\n");

        const aiResponse = await getAIResponse(message, historyContext);
        console.log(`[AI Response]: ${aiResponse}`);

        // Detect if AI suggested booking and user seems interested
        if (aiResponse.toLowerCase().includes("book test drive") || aiResponse.toLowerCase().includes("hands-on drive")) {
            await sendInteractiveMessage(sender, templates.getBookButton(aiResponse));
        } else {
            await sendMessage(sender, aiResponse);
        }

        // 5. Save history (only if we have valid content)
        if (message && aiResponse) {
            await new Chat({ sender, role: "user", content: message }).save();
            await new Chat({ sender, role: "assistant", content: aiResponse }).save();
        }

        res.status(200).send("Message processed");
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