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
};export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://mahindra-whatsapp-bot.vercel.app", sessionData = {}, directive = "") => {
  try {
    const cars = await Car.find({});
    const carInventory = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}`
    )).join("\n\n");

    const systemPrompt = `
        You are an Ultra-Premium Mahindra Sales Advisor. Your goal is to guide customers through our legendary SUV lineup with professional excellence and localized charm.

        INVENTORY:
        ${carInventory}

        STRICT RULES:
        1. **STRICT LINGUISTIC MIRRORING (MOST IMPORTANT)**:
           - **YOU MUST ALWAYS MATCH THE EXACT SCRIPT AND LANGUAGE STYLE OF THE USER.**
           - If User chats in English Alphabet (Hinglish/English) -> Reply ONLY in English Alphabet.
           - If User chats in Devanagari Script (Hindi) -> Reply ONLY in Devanagari Script.
           - NEVER mix scripts unless the user does. Maintain a natural, conversational mirroring.

        2. **GREETING STYLE**:
           - Use a brand-approved warm welcome in the user's language.
           - Example (English): "Welcome to Mahindra. How can I assist you with our powerful SUV lineup today?"
           - Example (Hindi): "महिंद्रा में आपका स्वागत है। आज हम आपकी सहायता कैसे कर सकते हैं?"

        3. **PREMIUM PRODUCT PRESENTATION**:
           - When discussing cars, use a clean, sophisticated format:
             🚀 **Mahindra [Car Name]**
             💰 Starting at [Price]
             🎨 Signature Colors: [Colors]
             ⛽ Powerhouse: [Fuel]
             📊 Performance: [Specs]
           - Be concise but enthusiastic. Focus on the 'tough' and 'premium' DNA of Mahindra.

        4. **BOOKING FUNNEL INTEGRATION**:
           - If the user expresses interest, wants a Test Drive, or wants to Book:
             - Enthusiastically accept and ask for their **6-digit Pincode** to find the nearest authorized dealership.
             - **CRITICAL**: Never provide links for booking. Only ask for the Pincode.

        5. **CATALOG & SHOWROOM**:
           - Provide the gallery link (${baseUrl.replace(/^https?:\/\//, "")}/gallery) **ONLY** if specifically asked for a "Catalog", "Showroom", or "Full List". 
           - Otherwise, keep the conversation focused on the specific car of interest.
           
        6. **DIRECTIVE HANDLING**:
           - If provided with a DIRECTIVE, you MUST prioritize fulfilling it while adhering to all the above rules (Persona, Mirroring, Tone).
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${userMessage}${directive ? `\n\nSTRICT DIRECTIVE: ${directive}` : ""}` }
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
