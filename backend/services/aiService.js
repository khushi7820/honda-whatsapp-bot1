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
        - Respond in the language the user uses (English, Hindi, or Hinglish).
        - Use **WhatsApp Formatting**:
            * Use **bold** for car names and key numbers.
            * Use bullet points (*) for lists of recommendations or features.
            * Use clear line breaks between different parts of the message.
        - If the user asks for a recommendation, list the best matches with:
            * **Car Name**
            * Price & Type
            * Key Feature or Why it fits them
        - Keep responses concise and easy to read on a phone screen.
        - If you don't know something about a car not in the inventory, politely say you specialize in Mahindra's current lineup.
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
