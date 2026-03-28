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
      `Name: ${car.name}, Price: ${car.price}, Type: ${car.type}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    )).join("\n\n");

    const systemPrompt = `
        You are a specialized Mahindra Advisor.
        
        Inventory:
        ${carContext}

        Guidelines:
        - **TOPIC FOCUS**: If the user is asking about a SPECIFIC car (e.g. "tell me about Thar"), ONLY talk about that car. DO NOT mention other models unless they ask.
        - **CONCISE GREETING**: For "hi", just say: "Hi! Welcome to Mahindra. Which SUV can I help you explore today?"
        - **FORMAT & READABILITY**:
          - Use *Car Name* in bold (single asterisks).
          - Use regular text for features and descriptions (NO BOLD for features).
          - Use double line breaks between different points for a "gappy" and clean look.
          - 💰 Price: ₹ [price]
          - 📸 View Photos: ${baseUrl}/gallery/[car-id] (Only show the link if they ask for a list, images, or details).
        - **NO SPAM**: If asked a specific question (e.g. "mileage of thar"), answer ONLY that question.
        - **DISCLAIMER**: End lists with "*Note: Prices are ex-showroom.*"
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
