import Groq from "groq-sdk";
import Car from "../models/Car.js";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const transcribeAudio = async (buffer) => {
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: await Groq.toFile(buffer, "audio.mp3"),
      model: "whisper-large-v3",
    });
    return transcription.text;
  } catch (error) {
    console.error("❌ Transcription Error:", error.message);
    return null;
  }
};export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://mahindra-whatsapp-bot.vercel.app", sessionData = {}, directive = "") => {
  try {
    const cars = await Car.find({});
    const carInventory = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}`
    )).join("\n\n");

    const containsDevanagari = /[\u0900-\u097F]/.test(userMessage);
    const scriptHint = containsDevanagari ? "USER IS USING HINDI SCRIPT. REPLY IN DEVANAGARI ONLY." : "USER IS USING LATIN/ENGLISH SCRIPT. DO NOT USE HINDI CHARACTERS (DEVANAGARI) AT ALL.";

    const systemPrompt = `
You are a **Premium Mahindra Sales Advisor**.
Your tone: Professional, Sophisticated, Exclusive.

**STRICT LANGUAGE RULES (CRITICAL):**
1. **SAME LANGUAGE**: Reply in the EXACT same language as the user (English, Hindi, Hinglish, etc.).
2. **AUDIO EXCEPTION**: If the user sends a **Hindi Audio** message, you MUST reply in **Hinglish Text** (Hindi written in English/Latin characters).
3. **SCRIPT LOCK**: Match user script perfectly.

**CONVERSATION RULES:**
1. **BREVITY**: Keep answers short, clear, and informative. No long sentences.
2. **CAR DETAILS**: If asked about any car, provide details using the Emoji Template (💰 🎨 ⛽ 📊) and add exactly one line asking for their 6-digit Pincode to check availability.
3. **BOOKING**: If they say "book", "book karo", etc., ONLY ask for their 6-digit Pincode. No other info.
**AUDIO FAILURE RULE:**
1. If the message says "User sent an audio message but error occurred...", politely ask the user to type their message. DO NOT repeat old car lists. 

**KNOWLEDGE**: ${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `[SCRIPT HINT: ${scriptHint}]\n\nHistory:\n${historyContext}\n\nCurrent Message: ${userMessage}${directive ? `\n\nDIRECTIVE: ${directive}` : ""}` }
    ];

    const getCompletion = async (modelName, temp) => {
      let attempts = 0;
      while (attempts < 2) {
        try {
          return await groq.chat.completions.create({
            messages,
            model: modelName,
            temperature: temp,
          });
        } catch (e) {
          attempts++;
          if (attempts >= 2) throw e;
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    };

    try {
      const completion = await getCompletion("llama-3.3-70b-versatile", 0.5);
      return completion.choices[0]?.message?.content;
    } catch (primaryError) {
      console.warn("⚠️ Primary AI Model Busy/Failed, switching to Fallback...");
      const fallbackCompletion = await getCompletion("llama-3.1-8b-instant", 0.6);
      return fallbackCompletion.choices[0]?.message?.content;
    }
  } catch (error) {
    console.error("❌ Critical AI Failure:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
