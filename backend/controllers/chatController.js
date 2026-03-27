import { getAIResponse } from "../services/aiService.js";
import { sendMessage } from "../services/whatsappService.js";
import Chat from "../models/Chat.js";
import dotenv from "dotenv";

dotenv.config();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// GET: Webhook verification
export const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
};

// POST: Handle incoming messages
export const handleWebhook = async (req, res) => {
    const body = req.body;

    // Check if it's a WhatsApp message
    if (body.object === "whatsapp_business_account") {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const msg = body.entry[0].changes[0].value.messages[0];
            const phoneNumber = msg.from;
            const userMessage = msg.text.body;

            console.log(`Received message from ${phoneNumber}: ${userMessage}`);

            try {
                // Get AI response
                const aiResponse = await getAIResponse(userMessage, phoneNumber);

                // Send response back via WhatsApp
                await sendMessage(phoneNumber, aiResponse);

                // Save to Database
                const newChat = new Chat({
                    phoneNumber,
                    userMessage,
                    aiResponse
                });
                await newChat.save();

                console.log("Chat saved to database.");
            } catch (error) {
                console.error("Error processing message:", error);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};