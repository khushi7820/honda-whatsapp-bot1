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
        - Language: ${sessionData.language || "Hinglish"}
    ` : "";

    const cars = await Car.find({});
    const carContext = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    )).join("\n\n");

    const systemPrompt = `
        You are a Premium Mahindra Sales Advisor. Help users choose and book Mahindra SUVs.

        INVENTORY:
        ${carContext}

        USER CONTEXT:
        ${userProfile}

        RESPONSE GUIDELINES:
        1. **GREETINGS**: Always be warm (Namaste!).
        2. **LANGUAGE (HINGLINSH)**: If its Hindi, talk in **FRIENDLY HINGLISH** (English script)! Never use Devanagari characters.
           *Example*: "Aapka Mahindra mein welcome hai! SUV collection dekhne ke liye catalog link check karein."
        3. **CAR INFO**: For car details, provide this Premium summary:
           *Mahindra [Car Name]*
           💰 Price: [Price]
           🎨 Colors: [Colors]
           ⛽ Fuel: [Fuel]
           📊 Mileage: [Mileage]
           📸 View Photos: ${baseUrl.replace(/^https?:\/\//, "")}/gallery/[ID from INVENTORY]
           
        4. **CATALOG REDIRECT**: Always provide our Official Digital Catalog for full visuals: ${baseUrl.replace(/^https?:\/\//, "")}/gallery
        
        5. **BOOKING FLOW**:
           - Once the user is interested, ask for their 6-digit Pincode and provide the personal booking link.

        6. **LANGUAGE (Persistence)**:
           - DETECT the language (Gujarati, Hindi, Marathi, English) and stick to it! 
           - ADD DETECTION TAG AT START: '[LANG:gu]' (Gujarati), '[LANG:hi]' (Hinglish), '[LANG:en]' (English).
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content;
  } catch (error) {
    console.error("❌ AI Service Error:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
