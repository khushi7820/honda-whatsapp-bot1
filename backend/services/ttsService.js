import axios from "axios";
import FormData from "form-data";

/**
 * Text-to-Speech & Temporary Hosting Service
 * Generates audio file from text using Google TTS and hosts it on uguu.se
 */
export async function generateTTS(text, lang = "hi") {
    try {
        console.log(`🎙️ [TTS] Generating ${lang} audio for: "${text.substring(0, 30)}..."`);
        
        const ttsLang = lang === "hi" ? "hi-IN" : "en-US";
        // Google TTS standard endpoint
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.substring(0, 200))}&tl=${ttsLang}&client=tw-ob`;

        const ttsResponse = await axios.get(ttsUrl, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });

        const buffer = Buffer.from(ttsResponse.data);
        
        // 📤 Upload to uguu.se (Temporary Hosting - 24h)
        const form = new FormData();
        form.append("files[]", buffer, {
            filename: `voice-${Date.now()}.mp3`,
            contentType: "audio/mpeg"
        });

        const uploadRes = await axios.post("https://uguu.se/upload.php", form, {
            headers: {
                ...form.getHeaders()
            }
        });

        const uploadData = uploadRes.data;
        if (!uploadData.success || !uploadData.files?.[0]?.url) {
            throw new Error("Failed to upload audio to temporary hosting");
        }

        const hostedUrl = uploadData.files[0].url;
        console.log("✅ [TTS] Audio hosted at:", hostedUrl);
        return hostedUrl;
    } catch (error) {
        console.error("❌ [TTS] Error generating/hosting TTS:", error.message);
        return null;
    }
}
