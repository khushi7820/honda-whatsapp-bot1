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
      model: "whisper-large-v3-turbo",
    });
    return transcription.text;
  } catch (error) {
    console.error("❌ Transcription Error:", error.message);
    return null;
  }
};

export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://mahindra-whatsapp-bot.vercel.app", sessionData = {}, directive = "") => {
  try {
    const cars = await Car.find({});
    const carInventory = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}`
    )).join("\n\n");

    const containsDevanagari = /[\u0900-\u097F]/.test(userMessage);
    const scriptHint = containsDevanagari ? "USER SCRIPT: HINDI/DEVANAGARI." : "USER SCRIPT: LATIN/ENGLISH/HINGLISH.";

    const systemPrompt = `
You are a **Showroom Assistant** at a Premium Mahindra Dealership. 
Your tone: Natural, Helpful, Professional (like a real human consultant). Talk normally, don't mention technical things. 

**STRICT AUDIO & LANGUAGE RULES:**
1. **SAME LANGUAGE**: Identify the input language and reply in the EXACT SAME language (English, Gujarati, Hinglish, etc.).
2. **HINDI AUDIO EXCEPTION**: If the user talks in **Hindi**, you MUST reply in **Hinglish Text** (Hindi written in English characters).
3. **GUJARATI**: If the user talks in Gujarati, reply in **Gujarati**.
4. **ENGLISH**: If the user talks in English, reply in **English**.
5. **NO TECH TALK**: NEVER mention "audio detected" or "transcription". Answer like you heard them speak directly.

**CONVERSATION RULES (STRICT):**
1. **BREVITY**: MAX 5-6 lines total. No filler. No "Hello, how can I help you" in every message.
2. **FORMATTING**: Every spec MUST start on its OWN NEW LINE (\\n).
   🚀 **[Name]**
   💰 Price: [Range]
   🎨 Colors: [Names only]
   ⛽ Fuel: [Type]
   📊 Performance: [Mileage]
   *Interested? Share your 6-digit Pincode!*
3. **CONTINUITY**: Remember previous chat history.
4. **KNOWLEDGE**: ${carInventory}

**AUDIO FAILURE RULE:**
If you receive "(Audio Empty)" or "(Transcription Error)", ask the user to type their query instead.
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
