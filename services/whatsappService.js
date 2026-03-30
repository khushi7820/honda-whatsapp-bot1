import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

/**
 * Send a plain text session message via 11za API.
 */
export const sendMessage = async (to, text) => {
    try {
        // Clear non-numeric chars from destination (e.g. "@s.whatsapp.net")
        const cleanTo = to.split("@")[0].replace(/\D/g, "");
        
        console.log(`[11za] Sending Text to ${cleanTo}: "${text.slice(0, 50)}..."`);
        console.log(`[11za] Debug Info - Origin: ${process.env.ZA_ORIGIN}, Token Length: ${process.env.ZA_TOKEN?.length || 0}`);
        
        const response = await axios.post(API_URL, {
            authToken: process.env.ZA_TOKEN,
            sendto: cleanTo,
            text: text,
            originWebsite: process.env.ZA_ORIGIN,
            contentType: "text"
        }, { timeout: 10000 }); // 10s timeout
        
        console.log("✅ 11za Success:", response.status, JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error("❌ 11za Error Details:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
};

/**
 * Send an interactive message (Buttons or Lists) via 11za API.
 */
export const sendInteractiveMessage = async (to, interactive) => {
    try {
        const cleanTo = to.split("@")[0].replace(/\D/g, "");
        console.log(`[11za] Sending Interactive to ${cleanTo}...`);
        
        const response = await axios.post(API_URL, {
            authToken: process.env.ZA_TOKEN,
            sendto: cleanTo,
            type: "interactive",
            interactive: interactive,
            originWebsite: process.env.ZA_ORIGIN
        }, { timeout: 10000 });

        console.log("✅ 11za Interactive Success:", response.status, JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error("❌ 11za Interactive Error:", error.response?.status, JSON.stringify(error.response?.data) || error.message);
        // Fallback to text if interactive fails (already uses cleanTo inside sendMessage)
        const fallbackText = interactive.body?.text || "Please choose an option from the menu.";
        return sendMessage(to, fallbackText);
    }
};
