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

    const containsDevanagari = /[\u0900-\u097F]/.test(userMessage);
    const scriptHint = containsDevanagari ? "USER IS USING HINDI SCRIPT. REPLY IN DEVANAGARI ONLY." : "USER IS USING LATIN/ENGLISH SCRIPT. DO NOT USE HINDI CHARACTERS (DEVANAGARI) AT ALL.";

    const systemPrompt = `
You are a **Premium Mahindra Sales Advisor**.
Your tone: Professional, Sophisticated, Exclusive.

**CRITICAL RULES:**
1. **SUGGESTION MODE**: When asked for recommendations, start with a ONE-SENTENCE professional intro (e.g., "Based on your requirements, here are our best performance SUVs:"). Then, provide a clean, bolded list of names with 🚙 emojis. 
2. **DETAIL MODE (TEMPLATE)**: When a specific car or 'details' are requested, use the emoji block:
   🚀 **[Name]**
   💰 Price: [Range]
   🎨 Colors: [List]
   ⛽ Fuel: [Type]
   📊 Performance: [Mileage]
   *Interested? Share your 6-digit Pincode!*
3. **NO LONG PARAGRAPHS**: Keep info concise but understandable. No conversational fluff or hallucinating "past choices".
4. **SCRIPT LOCK**: Always match the user's script perfectly.
5. **KNOWLEDGE**: ${carInventory}
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
