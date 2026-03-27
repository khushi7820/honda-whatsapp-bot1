import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

export const sendMessage = async (to, text) => {
    try {
        const response = await axios({
            method: "POST",
            url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            },
            data: {
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: text }
            }
        });
        console.log("Message sent to WhatsApp successfully.");
        return response.data;
    } catch (error) {
        console.error("WhatsApp Service Error:", error.response?.data || error.message);
        throw error;
    }
};
