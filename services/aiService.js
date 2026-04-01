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
        
        2. **STRICT MIRROR SCRIPT & LANGUAGE**: 
           - **YOU MUST ALWAYS MATCH THE LANGUAGE AND SCRIPT OF THE USER MESSAGE.**
           - IF User speaks English alphabet -> Reply ONLY in English alphabet.
           - IF User speaks in Hinglish -> Reply ONLY in Hinglish.
           - **IGNORE** any previous session scripts. Match the language of the **CURRENT** message only. 
        
        3. **PREMIUM BALANCED INFOMATION**: 
           - When providing car details, use a **CLEAN & BOLD** format:
             **Mahindra [Car Name]**
             💰 Price: [Price]
             🎨 Colors: [Colors]
             ⛽ Fuel: [Fuel]
             📊 Mileage: [Specs]
           - If user asks for specific info or references (1st one, etc.), provide this full premium list.

        4. **BOOKING REDIRECTION (CRITICAL)**: 
           - IF the user wants to "Book", "Test Drive", or is "Interested", you MUST ask for their **6-digit Pincode** to check availability.
           - DO NOT provide links for booking. Only ask for the Pincode.
           - Mention that we will confirm their **Location** once they provide the Pincode.

        5. **CATALOG (STRICT)**: 
           - **ONLY** provide the showroom link (${baseUrl.replace(/^https?:\/\//, "")}/gallery) IF the user explicitly asks for "Catalog", "Showroom", or a complete "List of cars". 
           - **NEVER** include the gallery link in general responses or booking flows.
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}` }
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
      const completion = await getCompletion("llama-3.3-70b-versatile", 0.3);
      return completion.choices[0]?.message?.content;
    } catch (primaryError) {
      console.warn("⚠️ Primary AI Model Busy/Failed, switching to Fallback...");
      const fallbackCompletion = await getCompletion("llama-3.1-8b-instant", 0.5);
      return fallbackCompletion.choices[0]?.message?.content;
    }
  } catch (error) {
    console.error("❌ Critical AI Failure:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
