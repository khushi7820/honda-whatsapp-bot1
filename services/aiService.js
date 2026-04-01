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
        1. **GREETING**: Only for the first message (Hi/Hello), reply:
           "Hi. Welcome to Mahindra. How can I assist you with our SUVs today?"
        
        2. **STRICT SCRIPT MIRRORING (MOST IMPORTANT)**: 
           - **MATCH THE SCRIPT OF THE LAST USER MESSAGE 100%.**
           - **IGNORE** THE SCRIPT OF THE CONVERSATION HISTORY. If the history is in Gujarati but the current message is in English, you MUST respond in English only. 
           - **NEVER** use Gujarati or Devanagari script for English or Hinglish users.
        
        3. **HYPER-DIRECT**: Answer ONLY the specific question asked. No extra talk.
           
        4. **FORMATTING**: Use these specific indicators for specs:
           💰 Price: [Price]
           🎨 Colors: [Colors]
           ⛽ Fuel/Mileage: [Specs]
        
        5. **NO LINKS**: NEVER include any image links in the chat.
        
        6. **CATALOG**: Only provide the showroom link (${baseUrl.replace(/^https?:\/\//, "")}/gallery) if explicitly requested.
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}` }
    ];

    let attempts = 0;
    while (attempts < 2) {
      try {
        const completion = await groq.chat.completions.create({
          messages,
          model: "llama-3.1-8b-instant",
          temperature: 0.5,
        });
        return completion.choices[0]?.message?.content;
      } catch (e) {
        attempts++;
        if (attempts >= 2) throw e;
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
      }
    }
  } catch (error) {
    console.error("❌ AI Service Error:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
