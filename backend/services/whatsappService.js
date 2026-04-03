import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

/**
 * Send text message using 11za API format.
 */
export const sendMessage = async (to, text) => {
    try {
        const payload = {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            text: text,
            originWebsite: process.env.ZA_ORIGIN,
            contentType: "text"
        };
        const response = await axios.post(API_URL, payload);
        return response.data;
    } catch (error) {
        console.error("❌ 11za API (Text) Error:", error.response?.status, error.response?.data || error.message);
        return null;
    }
};

/**
 * Send image message using 11za API format.
 */
export const sendImage = async (to, imageUrl, caption) => {
    try {
        const payload = {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            text: caption || "Image from Mahindra",
            originWebsite: process.env.ZA_ORIGIN,
            contentType: "image", // Fix for Invalid contentType error
            mediaUrl: imageUrl
        };
        const response = await axios.post(API_URL, payload);
        return response.data;
    } catch (error) {
        console.error("❌ 11za API (Image) Error:", error.response?.status, error.response?.data || error.message);
        // Fallback to text
        if (caption) await sendMessage(to, caption);
        return null;
    }
};

/**
 * Send interactive message using 11za API format.
 */
export const sendInteractiveMessage = async (to, templateData) => {
    try {
        const payload = {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            originWebsite: process.env.ZA_ORIGIN,
            contentType: "template", // This is usually required for interactive items
            ...templateData
        };

        console.log(`[11za] Sending INTERACTIVE to ${to}...`);
        const response = await axios.post(API_URL, payload);
        console.log(`[11za] Response:`, response.data);
        return response.data;

    } catch (error) {
        console.error("❌ 11za API (Interactive) Error:", error.response?.status, error.response?.data || error.message);
        return null;
    }
};

export const sendAudio = async (to, audioUrl) => {
    try {
        const payload = {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            originWebsite: process.env.ZA_ORIGIN,
            contentType: "audio",
            mediaUrl: audioUrl
        };
        const response = await axios.post(API_URL, payload);
        return response.data;
    } catch (error) {
        console.error("❌ 11za Audio API Error:", error.response?.status, error.message);
        return null;
    }
};

export const sendTemplate = async (to, templateName, language, mediaUrl = "", name = "", buttonValue = "", headerData = "", filename = "", variables = [], tags = "") => {
    try {
        const payload = {
            authToken: process.env.ZA_TOKEN,
            name: name,
            sendto: to,
            originWebsite: process.env.ZA_ORIGIN,
            templateName: templateName,
            language: language || "en",
            buttonValue: buttonValue, // e.g., "https://11za.com" or ["url1", "url2"]
            headerdata: headerData,
            myfile: mediaUrl,
            myfilename: filename,
            data: variables, // dynamic template variables
            tags: tags
        };

        const response = await axios.post("https://api.11za.in/apis/template/sendTemplate", payload);
        return response.data;
    } catch (error) {
        console.error("❌ 11za Template API Error:", error.response?.status, error.message);
        return null;
    }
};

export const downloadMedia = async (urlOrId) => {
    try {
        let finalUrl = urlOrId;
        const authToken = process.env.ZA_TOKEN;

        // Ensure we have a proper 11za download URL with token
        if (!finalUrl.startsWith("http")) {
            const mId = finalUrl.includes("mediaId=") ? finalUrl.split("mediaId=")[1]?.split("&")[0] : finalUrl;
            finalUrl = `https://api.11za.in/apis/sendMessage/downloadMedia?mediaId=${mId}&authToken=${authToken}`;
        } else if (!finalUrl.includes("authToken=")) {
            finalUrl += (finalUrl.includes("?") ? "&" : "?") + `authToken=${authToken}`;
        }

        console.log(`[Media Debug] Clean Download Attempt: ${finalUrl}`);

        // Very basic GET - 11za often rejects if headers like 'Accept' or 'Authorization' are present on pre-signed URLs
        const response = await axios.get(finalUrl, { 
            responseType: "arraybuffer",
            timeout: 25000
        });

        const buffer = Buffer.from(response.data);
        const responseString = buffer.toString('utf-8');

        // Handle JSON Base64 delivery
        if (responseString.trim().startsWith("{") && responseString.includes("base64")) {
            try {
                const jsonData = JSON.parse(responseString);
                const base64Data = jsonData.data?.base64 || jsonData.base64;
                if (base64Data) return Buffer.from(base64Data, 'base64');
            } catch (e) { }
        }
        
        return buffer;
    } catch (error) {
        console.error("❌ 11za Download Fatal Error:", error.response?.status || "TIMEOUT", error.message);
        return null;
    }
};
