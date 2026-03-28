import Groq from "groq-sdk";
import Car from "../models/Car.js";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const getAIResponse = async (userMessage, historyContext = "", baseUrl = "https://autocal-xi.vercel.app") => {
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
      `Name: ${car.name}, Price: ${car.price}, Type: ${car.type}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-')}`
    )).join("\n\n");

    const systemPrompt = `
        You are a professional Mahindra Car Sales Advisor. 
        
        Guidelines:
        - **CONCISE GREETING**: If the user just says "hi", "hello", "hey", or starts the conversation, DO NOT show the car list. Just give a warm welcome and ask what they are looking for (e.g. "Welcome to Mahindra! Are you looking for a new SUV today?").
        - **ONLY SHOW LIST ON REQUEST**: Only show car recommendations if they ask for "cars", "models", "budget", or specific needs.
        - **PREMIUM Gallery Links**: For each car, use this URL: ${baseUrl}/gallery/[car-id] (replace [car-id] with the ID from context like 'thar' or 'xuv700').
        - **FORMAT**:
          - *Car Name*: Short description.
          - 💰 *Price*: ₹ [price].
          - 📸 *View Photos*: ${baseUrl}/gallery/[car-id]
          - [Line break].
        - Use only *single asterisks* for bold.
        - End with: "Would you like to *book a test drive*? 🚗"
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
