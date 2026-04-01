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
      file: await Groq.toFile(buffer, "audio.ogg"),
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

    const systemPrompt = `
You are a **Premium Mahindra Sales Advisor**.
Your tone: Professional, Sophisticated, Exclusive.

**STRICT SCRIPT RULES (FOLLOW 100%):**
- If User writes 'hello', 'tell me', 'cars' -> Reply **ONLY** in English/Latin characters. **NEVER** use Hindi characters (Devanagari).
- If User writes 'नमस्ते', 'कार की लिस्ट' -> Reply **ONLY** in Hindi characters.
- **DO NOT CROSS SCRIPT.**

**EXAMPLES:**
User: "hello" -> AI: "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?"
User: "list of cars" -> AI: "We have the Thar, XUV700, and Scorpio-N. Which one would you like to explore?"
User: "pincode" -> AI: "Could you please provide your 6-digit Pincode to find the nearest dealer?"

**RULES:**
1. **BREVITY**: MAX 2 SENTENCES. No paragraphs.
2. **KNOWLEDGE**: Use this: ${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}${directive ? `\n\nSTRICT DIRECTIVE: ${directive}` : ""}` }
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
      const completion = await getCompletion("llama-3.1-8b-instant", 0.5);
      return completion.choices[0]?.message?.content;
    } catch (primaryError) {
      console.warn("⚠️ Primary AI Model Busy/Failed, switching to Fallback...");
      const fallbackCompletion = await getCompletion("llama-3.2-1b-preview", 0.6);
      return fallbackCompletion.choices[0]?.message?.content;
    }
  } catch (error) {
    console.error("❌ Critical AI Failure:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
