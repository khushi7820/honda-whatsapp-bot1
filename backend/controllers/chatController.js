import { sendMessage, sendInteractiveMessage } from "../services/whatsappService.js";
import { getAIResponse } from "../services/aiService.js";
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import * as templates from "../utils/bookingTemplates.js";

export const handleWebhook = async (req, res) => {
    try {
        // 11za Webhook Format: { sender: "91...", message: "...", type: "text", interactive: { ... } }
        const { sender, message, type, interactive } = req.body;

        if (!sender) return res.status(200).send("No sender");

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

        // Detect if AI suggested booking and user seems interested
        if (aiResponse.toLowerCase().includes("book test drive") || aiResponse.toLowerCase().includes("hands-on drive")) {
            await sendInteractiveMessage(sender, templates.getBookButton(aiResponse));
        } else {
            await sendMessage(sender, aiResponse);
        }

        // 5. Save history
        await new Chat({ sender, content: message, role: "user" }).save();
        await new Chat({ sender, content: aiResponse, role: "assistant" }).save();

        res.status(200).send("Message processed");
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

export const verifyWebhook = (req, res) => {
    res.status(200).send("Webhook active");
};