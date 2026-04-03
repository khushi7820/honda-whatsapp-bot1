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

export const downloadMedia = async (url) => {
    try {
        // RAG Bot's working endpoint structure
        let mId = url.replace("/v1/media/", "").replace("/", "");
        if (mId.includes("mediaId=")) mId = mId.split("mediaId=")[1]?.split("&")[0] || mId;
        
        let fullUrl = `https://api.11za.in/apis/sendMessage/downloadMedia?mediaId=${mId}`;
        
        console.log(`[Media Debug] Downloading from: ${fullUrl} [TOKEN HIDDEN]`);

        const response = await axios.get(fullUrl, { 
            responseType: "arraybuffer",
            timeout: 12000,
            headers: {
                "Authorization": process.env.ZA_TOKEN // Header-based Auth like RAG bot
            }
        });

        let buffer;
        const contentType = response.headers['content-type'] || "";

        // Check if the response is actually JSON (base64 delivery like in RAG bot)
        if (contentType.includes("application/json")) {
            const jsonText = Buffer.from(response.data).toString('utf-8');
            try {
                const jsonData = JSON.parse(jsonText);
                if (jsonData.success && jsonData.data?.base64) {
                    console.log("[Media Debug] Detected Base64 JSON response, decoding...");
                    buffer = Buffer.from(jsonData.data.base64, 'base64');
                } else {
                    console.log("[Media Debug] JSON response received but missing base64 data.");
                    buffer = Buffer.from(response.data);
                }
            } catch (e) {
                buffer = Buffer.from(response.data);
            }
        } else {
            buffer = Buffer.from(response.data);
        }

        return buffer;
    } catch (error) {
        console.error("❌ 11za Media Download Error:", error.response?.status, error.message);
        return null;
    }
};
