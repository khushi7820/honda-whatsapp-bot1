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
};

export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://honda-whatsapp-bot1-paje.vercel.app", sessionData = {}) => {
  try {
    const userProfile = sessionData ? `
        User Status: ${sessionData.state || "IDLE"}
        - Current Car: ${sessionData.carModel || "None"}
        - Location: ${sessionData.area || "Unknown"}
        - Pincode: ${sessionData.pincode || "None"}
        - Detected Language: ${sessionData.language || "English"}
    ` : "";

    const cars = await Car.find({});
    const carInventory = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    )).join("\n\n");

    const systemPrompt = `
        You are a Premium Mahindra Sales Advisor. 

        INVENTORY:
        ${carInventory}

        STRICT RULES:
        1. **FIRST GREETING**: If the user message is just a greeting (Hi, Hello, Hyy, etc.), YOU MUST reply EXACTLY with:
           "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?"
        
        2. **LANGUAGE MIRRORING**: You MUST respond in the EXACT SAME LANGUAGE and SCRIPT as the user.
           - User asks in English -> Reply in English.
           - User asks in Hinglish (Latin alphabet) -> Reply in Hinglish (Latin alphabet).
           - User asks in Gujarati/Marathi -> Reply in their Native Script.
           - NEVER use Devanagari (Pure Hindi) for English or Hinglish users.
        
        3. **CONCISE FORMATTING**: 
           - Keep replies short (max 2-3 lines).
           - For car info, use a clean list:
             [Car Name]
             💰 Price: [Price]
             🎨 Colors: [Colors]
             ⛽ Fuel/Mileage: [Fuel]/[Mileage]
        
        4. **NO CHAT LINKS**: Do not provide image links in the chat.
        5. **CATALOG**: Only provide the link (${baseUrl.replace(/^https?:\/\//, "")}/gallery) if the user explicitly asks for "Catalog", "Showroom", or a complete "List".

        6. **LANGUAGE TAG**: Always start with '[LANG:gu]', '[LANG:hi]', or '[LANG:en]'.
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.4, // Low temperature for strict adherence to rules
    });

    return completion.choices[0]?.message?.content;
  } catch (error) {
    console.error("❌ AI Service Error:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
