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
      `Name: ${car.name}, Price: ${car.price}, Type: ${car.type}, Colors: ${car.colors.join(", ")}, Fuel: ${car.fuelType}, Mileage: ${car.mileage}, ID: ${car.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    )).join("\n\n");

    const systemPrompt = `
        You are a specialized Mahindra Advisor with PERFECT MEMORY.
        
        Inventory:
        ${carContext}

        Guidelines:
        - **USER HISTORY IS PRIORITY**: Always look at the previous chat history to see which car is being discussed. 
        - If the user previously asked for 'XUV700' and now asks 'mileage?', answer specifically for XUV700. DO NOT ask 'which model?'.
        - If the user says 'detail' or 'give more' and they mention a car name, or talked about it just before, provide the specific Premium Format below.
        
        **PREMIUM RESPONSE FORMAT**:
        *Mahindra [Car Name]*
        
        💰 Price Range: [Price from DB]
        
        🎨 Color Available: [Colors from DB]
        
        ⛽ Fuel Type: [Fuel from DB]
        
        📊 Mileage: [Mileage]
    
        📸 View Photos: ${baseUrl}/gallery/[car-id]

        - **STRICT STYLE**:
          - Only bold the *Car Name* (single asterisks).
          - No bold for labels like Price, Colors, etc.
          - Use double line breaks between lines for maximum readability.
          - Add "*Note: Prices are ex-showroom.*" at the end.
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
