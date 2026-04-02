// Version 1.1.42 - Atomic Pincode Fix (No Emojis allowed during booking)
import Groq from "groq-sdk";
import dotenv from "dotenv";
import Car from "../models/Car.js";

dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(buffer) {
    try {
        const file = new File([buffer], "audio.ogg", { type: "audio/ogg" });
        const transcription = await groq.audio.transcriptions.create({
            file,
            model: "whisper-large-v3-turbo",
            response_format: "text",
        });
        return transcription;
    } catch (error) {
        console.error("❌ Transcription Failed:", error.message);
        return null;
    }
}

export async function getAIResponse(userMessage, history, baseUrl, session) {
  try {
    const cars = await Car.find({});
    // No Emojis in Knowledge Base to prevent copy-paste hallucination
    const carInventory = cars.map(car => (
      `CAR_NAME: ${car.name}\nPRICE: ${car.price}\nCOLORS: ${car.colors.join(", ")}\nFUEL: ${car.fuelType}\nMILEAGE: ${car.mileage}\nFEATURES: ${car.features?.join(", ")}\nDESC: ${car.description}`
    )).join("\n\n---\n\n");

    const currentCar = session.data.carModel || "Mahindra SUV";

    const systemPrompt = `
You are a natural, professional Mahindra Sales Advisor.
CURRENT TOPIC: **${currentCar}**. 

**CRITICAL RULE - PINCODE ONLY (NO EMOJIS):**
If the user says "book", "buy", "interested", or "test drive":
- Your ONLY response must be a single line asking for a 6-digit Pincode.
- **NEVER** include prices (💰), colors (🎨), fuel (⛽), or performance (📊) emojis in this message.
- **NEVER** include the car specifications in this message.
- Example: "Excellent! Please share your 6nd-digit Pincode to search for the nearest dealership."

**CONVERSATION RULES:**
1. **STRICT CAR LOCK**: Stay on **${currentCar}** unless a new car is named.
2. **FORMATTING**: Use BULLETS (🛡️) on NEW LINES for features/safety ONLY IF specifically asked.
3. **KNOWLEDGE**: ${carInventory}

**LANGUAGE:**
Mirror the user (Hinglish/Gujarati/English) as per session preference.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${history}\n\nUser Message: ${userMessage}` }
    ];

    const getCompletion = async (modelName) => {
        try {
          return await groq.chat.completions.create({
            messages,
            model: modelName,
            temperature: 0.0,
          });
        } catch (e) { return null; }
    }

    let completion = await getCompletion("llama-3.3-70b-versatile");
    if (!completion) completion = await getCompletion("llama-3.1-8b-instant");

    return completion ? completion.choices[0].message.content : "Please provide your 6-digit Pincode.";
  } catch (error) {
    console.error("❌ AI Logic Error:", error.message);
    return "Please provide your 6-digit Pincode.";
  }
}
