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
        Previous/Current Booking Details:
        - Car: ${sessionData.carModel || "None Selected"}
        - Date: ${sessionData.date || "None Selected"}
        - Time Slot: ${sessionData.time || "None Selected"}
        - Color: ${sessionData.color || "None Selected"}
        - Fuel Type: ${sessionData.fuel || "None Selected"}
        - Pincode: ${sessionData.pincode || "None Selected"}
    ` : "User is new.";

    // Guard: Prevent sending null/empty messages to Groq
    if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
      console.warn("[AI] Skipping Groq call — userMessage is empty/null:", userMessage);
      return "I didn't catch that. Could you please type your question?";
    }

    // Force string type to prevent 'content' property from being stripped
    const safeUserMessage = String(userMessage).trim();
    console.log(`[AI] Calling Groq with message: "${safeUserMessage}"`);

    // Fetch car data from DB for context
    const cars = await Car.find({});
    const carContext = cars.map(car => (
      `Name: ${car.name}, Price: ${car.price}, Type: ${car.type}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    )).join("\n\n");

    const systemPrompt = `
        You are a specialized Mahindra Advisor with PERFECT MEMORY.
        
        Inventory:
        ${carContext}

        Context:
        ${userProfile}

        Guidelines:
        - **MEMORY**: If the "User Profile Context" shows a Car and Date already selected, DON'T ask for them again. Congratulate them on their choice or help with further questions.
        
        - **LOCALIZED SERVICE**: If "LOCAL CONTEXT" or "USER CONTEXT" is provided in the message history:
          - Greet the user by their neighborhood if AREA is available (e.g. "I see you're in Vesu! 📍").
          - If a PINCODE is provided but no exact branch is found in my list, say: "I've noted your pincode [Pincode]. While we don't have a direct branch listed in my quick-lookup for this exact spot, I'll have our nearest executive reach out to you with the location!"
          - Explicitly mention the **Dealer Name** and **Address** when discussing bookings or visits.
          - Make the user feel like you are a local expert.

        - **SIMPLE GREETINGS**: If the user is just saying hello, respond with: "Hi! Welcome to Mahindra. How can I assist you with our SUVs today?" 
        
        - **EMI CALCULATOR**: If the user asks for "EMI" or "monthly payment" for a car:
          - Use a fixed 9.5% annual interest rate.
          - Formula (estimate): (Principal + (Principal * 0.095 * Years)) / (Years * 12).
          - Show monthly payment for 5 years and 7 years.
        
        - **COMPARISON**: If the user wants to compare two cars (e.g. "Thar vs Scorpio"):
          - Create a simple point-by-point comparison (Price, Mileage, Fuel).
          - Highlight which one is better for what purpose (e.g. Thar for Off-roading).

        - **DEALER LOCATOR**: If people ask for showrooms, tell them: "Just provide your 6-digit pin code, and I'll find the nearest dealer for you! 📍"

        - **GENERAL LIST**: Simply reply with a bulleted list of car names.
        
        **PREMIUM RESPONSE FORMAT**:
        *Mahindra [Car Name]*
        
        💰 Price Range: [Price from DB]
        🎨 Color Available: [Colors from DB]
        ⛽ Fuel Type: [Fuel from DB]
        📊 Mileage: [Mileage]
    
        📸 View Photos: ${baseUrl.replace(/^https?:\/\//, "")}/gallery/[car-id]

        **IMPORTANT**: Always end by asking: "Would you like a *hands-on drive* with the [Car Name]? 🚗"

        - **STRICT STYLE**:
          - Only bold the *Car Name*.
          - No bold for labels like Price, Colors, etc.
          - Use double line breaks between lines.
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${historyContext}\n\nCurrent Message: ${safeUserMessage}` }
    ];

    // Debug: Verify content fields exist before sending
    console.log("[AI] Messages payload check:", messages.map(m => ({ role: m.role, hasContent: !!m.content, contentLength: m.content?.length })));

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
    });

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Can you try again?";
  } catch (error) {
    console.error("AI Service Error:", error?.message || error);
    console.error("AI Full Error:", JSON.stringify(error?.response?.data || error?.error || {}, null, 2));
    return "I'm having a bit of trouble thinking right now. Please try again in a moment.";
  }
};
