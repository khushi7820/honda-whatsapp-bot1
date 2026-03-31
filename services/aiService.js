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
    console.error("Transcription Error:", error.message);
    return null;
  }
};

export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://autoai-xi.vercel.app", sessionData = {}) => {
  try {
    // Construct User Profile Context from session
    const userProfile = sessionData ? `
        User Status: ${sessionData.state || "NEW"}
        Known Details:
        - Car: ${sessionData.carModel || "None"}
        - Pincode: ${sessionData.pincode || "None"}
        - Area: ${sessionData.area || "None"}
        - Dealer: ${sessionData.selectedDealer || "None"}
    ` : "User is new.";

    if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
      return "I didn't catch that. Could you please type your message?";
    }

    const safeUserMessage = String(userMessage).trim();
    const cars = await Car.find({});
    const carContext = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    )).join("\n");

    const systemPrompt = `
        You are a specialized Mahindra Sales Expert. Be concise, professional, and helpful. 
        
        INVENTORY:
        ${carContext}

        USER CURRENT SESSION:
        ${userProfile}

        RULES:
        1. **BOOKING SHORTCUT**: 
           - If the user wants to book (e.g., "book this", "I want to buy"), don't be wordy. 
           - Ask: "Would you like to select a specific Color or Fuel type? If not, just provide your 6-digit Pincode to continue with the booking! 📍"
        
        2. **IF PINCODE PROVIDED**:
           - If a pincode is in the context or message, acknowledge the location (e.g. "Great! Since you're near ${sessionData.area || 'your location'}...").
           - Confirm that an executive from ${sessionData.selectedDealer || 'our team'} will call to finalize the date/time.

        3. **CAR INFO**: 
           - When showing car details, use this EXACT COMPACT format:
             *Mahindra [Car Name]*
             Price: [Price]
             Colors: [Colors]
             Fuel: [Fuel]
             Photos: ${baseUrl.replace(/^https?:\/\//, "")}/gallery/[car-id]
           - Ask ONLY ONE question at the end: "Shall we proceed with a test drive booking? 🚗"

        4. **GENERAL**:
           - Use simple Hindi-English (Hinglish) if the user does, otherwise professional English.
           - NO long paragraphs. Max 2-3 sentences per response.
           - Do NOT repeat info already in the "USER CURRENT SESSION".
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${safeUserMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    });

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("AI Service Error:", error?.message || error);
    return "I'm having a bit of trouble thinking right now. Please try again soon.";
  }
};
