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

**DETECTED PREFERENCE**: ${sessionData?.data?.language || "Detect from input"}

**STRICT LANGUAGE RULES:**
1. **STICK TO PREFERENCE**: You MUST reply in the language specified in **DETECTED PREFERENCE** above.
2. **HINDI/HINGLISH RULE**: If PREFERENCE is **hinglish** or input is **Hindi**, reply in **Hinglish Text** (Hindi written in English characters).
3. **GUJARATI**: If PREFERENCE is **gujarati**, reply in **Gujarati**.
4. **ENGLISH**: If PREFERENCE is **english**, reply in **English**.
5. **NO TECH TALK**: Never mention "audio detected". Just answer naturally.

**CONVERSATION RULES (STRICT):**
1. **MESSAGE PRIORITY**: ALWAYS prioritize the **Current Message** over the history. If the user asks for a general "list of cars", provide models from ALL categories (e.g. XUV700, Scorpio-N, Thar, XUV3XO). Do NOT stay stuck on previous types (like 6-7 seaters) unless they ask again.
2. **BREVITY**: MAX 4-5 lines total. Keep it tight.
3. **FORMATTING**: Every spec MUST start on its OWN NEW LINE (\\n). 
   🚀 **[Name]**
   💰 Price: [Range]
   🎨 Colors: [Names only]
   ⛽ Fuel: [Type]
   📊 Performance: [Mileage]
   *Interested? Share your 6-digit Pincode!*
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
