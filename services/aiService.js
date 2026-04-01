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

export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://autoai-xi.vercel.app", sessionData = {}) => {
  try {
    const userProfile = sessionData ? `
        User Status: ${sessionData.state || "IDLE"}
        - Current Car: ${sessionData.carModel || "None"}
        - Location: ${sessionData.area || "Unknown"}
        - Pincode: ${sessionData.pincode || "None"}
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
        1. **GREETINGS**: Always be polite. (e.g. "Namaste! Welcome to Mahindra. How can I help you?")
        2. **LANGUAGE**: If user speaks Hindi/Hinglish, reply in friendly Hinglish. Otherwise, use professional English.
        3. **PREMIUM FORMAT**: When discussing cars, use this format:
           *Mahindra [Car Name]*
           💰 Price: [Price]
           🎨 Colors: [Colors]
           ⛽ Fuel: [Fuel]
           📊 Mileage: [Mileage]
           📸 View Photos: ${baseUrl.replace(/^https?:\/\//, "")}/gallery/[ID from INVENTORY]
        
        4. **BOOKING FLOW**:
           - If the user wants to book (e.g., "book this", "I want a test drive"), say: 
             "Excellent choice! Would you like to pick a color first, or should we go straight to booking? If you're ready, just provide your 6-digit Pincode! 📍"

        5. **LOCATION**:
           - If the user provides a pincode, congratulate them and mention the local area/dealer if available in context.

        6. **CONCISE YET PREMIUM**: Keep it professional. No long essays, but don't be too robotic.
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
    });

    return completion.choices[0]?.message?.content;
  } catch (error) {
    console.error("❌ AI Service Error:", error.message);
    return "I'm having a bit of trouble thinking right now. Please try again.";
  }
};
