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
        
        console.log(`[11za] Sending to ${cleanTo}. Token: ${String(process.env.ZA_TOKEN).slice(0, 4)}... (Len: ${String(process.env.ZA_TOKEN||"").length})`);
        
        const response = await axios.post(API_URL, {
            authToken: process.env.ZA_TOKEN,
            sendto: cleanTo,
            text: text,
            originWebsite: process.env.ZA_ORIGIN,
            contentType: "text"
        }, { timeout: 10000 });
        
        console.log("✅ 11za Reply Status:", response.status, response.data);
        return response.data;
    } catch (error) {
        console.error("❌ 11za ERROR:", error.response?.status, JSON.stringify(error.response?.data));
        throw error;
    }
};

/**
 * Send an image via 11za API.
 */
export const sendImage = async (to, imageUrl, caption = "") => {
    try {
        const cleanTo = to.split("@")[0].replace(/\D/g, "");
        console.log(`[11za] Sending Image to ${cleanTo}: ${imageUrl}`);
        
        const response = await axios.post(API_URL, {
            authToken: process.env.ZA_TOKEN,
            sendto: cleanTo,
            type: "image",
            media: { url: imageUrl, caption: caption },
            originWebsite: process.env.ZA_ORIGIN
        }, { timeout: 10000 });

        console.log("✅ 11za Image Success:", response.status, JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error("❌ 11za Image Error:", error.response?.status, JSON.stringify(error.response?.data) || error.message);
        // Fallback to text link if image fails
        return sendMessage(to, `${caption}\nView Image: ${imageUrl}`);
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

/**
 * Download media from 11za URL with proper headers.
 */
export const downloadMedia = async (url) => {
    try {
        const fullUrl = url.startsWith("http") ? url : `${process.env.ZA_ORIGIN}${url}`;
        console.log(`[11za] Downloading media from: ${fullUrl}`);

        const response = await axios.get(fullUrl, { 
            responseType: "arraybuffer",
            headers: {
                "authToken": process.env.ZA_TOKEN,
                "Accept": "*/*"
            }
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.error("❌ 11za Media Download Error:", error.response?.status, error.message);
        return null;
    }
};

