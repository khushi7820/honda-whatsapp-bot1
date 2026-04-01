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
        
        2. **STRICT SCRIPT MIRRORING (CRITICAL)**: 
           - **YOU MUST REPLICATE THE SCRIPT OF THE USER'S LAST MESSAGE 100%.**
           - IF User speaks in English alphabet -> Reply ONLY in English alphabet.
           - IF User speaks in Hinglish -> Reply ONLY in Hinglish.
           - **NEVER** use Gujarati or Devanagari script if the current user message is in English. 
           - **IGNORE** the language of previous messages. Match the language of the **CURRENT** message only. 
        
        3. **HYPER-DIRECT ANSWERS (STRICT)**: 
           - Respond **ONLY** to what the user asked. No extra junk!
           - **IF** user asks for Price -> Give ONLY Price.
           - **IF** user asks for Features -> Give ONLY Features.
           - DO NOT provide the full spec list unless the user asks for "Full Details".
           - **NO REPEATED GREETINGS**: Do not say "Welcome to Mahindra" more than once.
        
        4. **NO CHAT LINKS**: **STRICTLY PROHIBITED** to provide image links in the chat.
        
        5. **CATALOG**: Only provide the link (${baseUrl.replace(/^https?:\/\//, "")}/gallery) if the user explicitly asks for "Catalog", "Showroom", or a complete "List".
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature: 0.2, 
    });

    return completion.choices[0]?.message?.content;
  } catch (error) {
    console.error("❌ AI Service Error:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
