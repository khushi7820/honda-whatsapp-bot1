import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://app.11za.in/apis/session/sendSessionMessage";

/**
 * Send a plain text session message via 11za API.
 */
export const sendMessage = async (to, text) => {
    try {
        console.log(`[11za] Sending Text to ${to}: "${text.slice(0, 50)}..."`);
        console.log(`[11za] Debug Info - Origin: ${process.env.ZA_ORIGIN}, Token Length: ${process.env.ZA_TOKEN?.length || 0}`);
        
        const response = await axios.post(API_URL, {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            message: text,
            origin: process.env.ZA_ORIGIN
        });
        
        console.log("✅ 11za Success:", response.status, JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error("❌ 11za Error Details:", {
            status: error.response?.status,
            data: error.response?.data,
            url: API_URL,
            origin: process.env.ZA_ORIGIN
        });
        throw error;
    }
};

/**
 * Send an interactive message (Buttons or Lists) via 11za API.
 */
export const sendInteractiveMessage = async (to, interactive) => {
    try {
        console.log(`[11za] Sending Interactive to ${to}...`);
        const response = await axios.post(API_URL, {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            type: "interactive",
            interactive: interactive,
            origin: process.env.ZA_ORIGIN
        });

        console.log("✅ 11za Interactive Success:", response.status, JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error("❌ 11za Interactive Error:", error.response?.status, JSON.stringify(error.response?.data) || error.message);
        // Fallback to text if interactive fails
        const fallbackText = interactive.body?.text || "Please choose an option from the menu.";
        return sendMessage(to, fallbackText);
    }
};
