import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/**
 * 11ZA API Configuration from stable test script.
 */
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
        
        console.log(`[11za] Sending TEXT to ${to}...`);
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
            contentType: "image",
            mediaUrl: imageUrl
        };

        console.log(`[11za] Sending IMAGE to ${to}: ${imageUrl}`);
        const response = await axios.post(API_URL, payload);
        return response.data;
    } catch (error) {
        console.error("❌ 11za API (Image) Error:", error.response?.status, error.response?.data || error.message);
        return null;
    }
};

/**
 * Send interactive message using 11za API format (Template/Buttons).
 */
export const sendInteractiveMessage = async (to, templateData) => {
    try {
        const payload = {
            authToken: process.env.ZA_TOKEN,
            sendto: to,
            originWebsite: process.env.ZA_ORIGIN,
            contentType: templateData.type || "template",
            ...templateData
        };

        console.log(`[11za] Sending INTERACTIVE to ${to}...`);
        const response = await axios.post(API_URL, payload);
        return response.data;
    } catch (error) {
        console.error("❌ 11za API (Interactive) Error:", error.response?.status, error.response?.data || error.message);
        return null;
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
