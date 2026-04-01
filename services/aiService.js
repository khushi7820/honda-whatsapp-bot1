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
        - Selected Car: ${sessionData.carModel || "None"}
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
        
        2. **MIRROR SCRIPT & LANGUAGE**: 
           - **YOU MUST ALWAYS MATCH THE LANGUAGE AND SCRIPT OF THE USER MESSAGE.**
           - IF the user speaks in English -> Reply ONLY in English.
           - IF the user speaks in Hinglish (Latin alphabet) -> Reply ONLY in Hinglish (Latin alphabet).
           - IF user switches language, match the new one immediately.
        
        3. **PREMIUM BALANCED INFOMATION**: 
           - When providing car details, use a **CLEAN & BOLD** format like this:
             **Mahindra [Car Name]**
             💰 Price: [Price]
             🎨 Colors: [Colors]
             ⛽ Fuel: [Fuel]
             📊 Mileage: [Specs]
           - If user asks for a simple "List of cars", provide only names.
           - If they ask for specific info (1st one, price of Thar, etc.), provide the **Full Premium List** above.

        4. **SMART MEMORY**: 
           - When user says "I go with 1st one" or "Show me 2nd car", YOU MUST check the conversation history to find exactly which car was listed first/second in the previous Advisor response.
        
        5. **NO CHAT LINKS**: NEVER provide image links in the chat.
        
        6. **CATALOG**: Only provide the link (${baseUrl.replace(/^https?:\/\//, "")}/gallery) if explicitly requested.
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
          model: "llama-3.3-70b-versatile",
          temperature: 0.3, 
        });
        return completion.choices[0]?.message?.content;
      } catch (e) {
        attempts++;
        if (attempts >= 2) throw e;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (error) {
    console.error("❌ AI Service Error:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
