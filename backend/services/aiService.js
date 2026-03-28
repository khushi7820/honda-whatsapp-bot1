import Groq from "groq-sdk";
import Car from "../models/Car.js";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const getAIResponse = async (userMessage, historyContext = "") => {
  try {
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
      `Name: ${car.name}, Price: ${car.price}, Type: ${car.type}, Mileage: ${car.mileage}, Features: ${car.features.join(", ")}, Description: ${car.description}`
    )).join("\n\n");

    const systemPrompt = `
        You are a professional Mahindra Car Sales Advisor. 
        Your goal is to help users explore Mahindra cars, answer their questions naturally, and provide personalized recommendations.
        
        Car Inventory:
        ${carContext}
        
        Conversation History:
        ${historyContext}

        Guidelines:
        - Be polite, helpful, and natural.
        - **IMPORTANT WhatsApp Bold**: WhatsApp uses a single asterisk for bold like *this*. NEVER use double asterisks like **this**.
        - Use **WhatsApp Formatting**:
            * Use *single asterisks* to make car names and prices bold (e.g., *Mahindra Thar*).
            * Use bullet points (-) for lists.
            * Use clear line breaks between cars.
        - Respond in the language the user uses (English, Hindi, or Hinglish).
        - If the user asks for a recommendation, list the matches like this:
          - *Car Name*: Mention type and price.
          - Features: List 2-3 key features.
        - persona: You are a specialized Mahindra Advisor. If they ask about other brands (Tata, Maruti), acknowledge them briefly but explain that you are an expert specifically for Mahindra cars and help them find a Mahindra alternative.
        `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: safeUserMessage }
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
