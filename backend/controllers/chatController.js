import { sendMessage, sendInteractiveMessage } from "../services/whatsappService.js";
import { getAIResponse } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import * as templates from "../utils/bookingTemplates.js";
import { connectDB } from "../config/db.js";

export const handleWebhook = async (req, res) => {
    try {
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
            if (type === "audio") {
                await sendMessage(sender, "I can't process audio messages yet. 😊");
                return res.status(200).send("Audio handled");
            }
            return res.status(200).send("No message mapping found");
        }

        // 1. Get/Create Session
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let session = await Session.findOne({ sender });
        if (!session) session = await new Session({ sender, state: "IDLE" }).save();

        console.log(`Msg from ${sender} [State: ${session.state}]: ${message || "Interactive"}`);

        // 2. Handle Interactive Replies (Button/List clicks)
        if (interactive) {
            const replyId = interactive?.button_reply?.id || interactive?.list_reply?.id;
            
            if (replyId === "action_book_test_drive") {
                session.state = "COLLECTING_PINCODE";
                await session.save();
                await sendMessage(sender, "Absolutely! Mind sharing your pincode? For example, 400069 😊");
                return res.status(200).send("OK");
            }

            if (replyId?.startsWith("date_")) {
                const date = interactive.list_reply.title;
                session.state = "IDLE";
                await session.save();
                await sendMessage(sender, `Perfect! Your slot for *${date}* is being processed. \n\nA Mahindra representative will call you for final confirmation. 🏁`);
                return res.status(200).send("OK");
            }
        }

        // 3. Handle Flow States (Pincode -> Date)
        if (session.state === "COLLECTING_PINCODE") {
            const pincode = message?.replace(/\D/g, "");
            if (pincode?.length === 6) {
                session.state = "COLLECTING_DATE";
                await session.save();
                await sendInteractiveMessage(sender, templates.getDateList());
                return res.status(200).send("OK");
            } else {
                await sendMessage(sender, "Please enter a valid *6-digit* pincode to find nearest showroom. 📍");
                return res.status(200).send("OK");
            }
        }

        // 4. Default: Get AI Response
        const history = await Chat.find({ sender }).sort({ timestamp: -1 }).limit(5);
        const historyContext = history.reverse().map(c => `${c.role}: ${c.content}`).join("\n");

        const aiResponse = await getAIResponse(message, historyContext, baseUrl);

        // Check for AI intent triggers
        const lowerRes = aiResponse.toLowerCase();
        if (lowerRes.includes("book test drive") || lowerRes.includes("hands-on drive")) {
            await sendInteractiveMessage(sender, templates.getBookButton(aiResponse));
        } else {
            await sendMessage(sender, aiResponse);
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