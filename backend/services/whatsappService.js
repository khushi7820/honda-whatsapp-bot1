import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const ZA_TOKEN = process.env.ZA_TOKEN;
const ZA_ORIGIN = process.env.ZA_ORIGIN;

const API_URL = "https://api.11za.in/apis/session/sendSessionMessage";

/**
 * Send a plain text session message via 11za API.
 */
export const sendMessage = async (to, text) => {
    try {
        const response = await axios.post(API_URL, {
            authToken: ZA_TOKEN,
            sendto: to,
            message: text,
            origin: ZA_ORIGIN
        });
        
        if (response.data.status === "error") {
            throw new Error(response.data.message || "11za API Error");
        }

        console.log(`Message sent to ${to} via 11za.`);
        return response.data;
    } catch (error) {
        console.error("11za Service Error:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Send an interactive message (Buttons or Lists) via 11za API.
 * 11za usually allows passing the standard Meta interactive object.
 */
export const sendInteractiveMessage = async (to, interactive) => {
    try {
        const response = await axios.post(API_URL, {
            authToken: ZA_TOKEN,
            sendto: to,
            type: "interactive",
            interactive: interactive,
            origin: ZA_ORIGIN
        });

        if (response.data.status === "error") {
            throw new Error(response.data.message || "11za API Error");
        }

        console.log(`Interactive message sent to ${to} via 11za.`);
        return response.data;
    } catch (error) {
        console.error("11za Interactive Error:", error.response?.data || error.message);
        // Fallback to text if interactive fails
        const fallbackText = interactive.body?.text || "Would you like to proceed?";
        return sendMessage(to, fallbackText);
    }
};
