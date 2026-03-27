import Groq from "groq-sdk";
import Car from "../models/Car.js";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export const getAIResponse = async (userMessage, phoneNumber) => {
  try {
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
        
        Guidelines:
        - Be polite, helpful, and natural (don't sound like a bot).
        - Respond in the language the user uses (English, Hindi, or Hinglish).
        - If the user asks for a recommendation (e.g., "SUV under 10 lakh"), suggest the best match from the inventory.
        - Focus on features, mileage, and price to help them decide.
        - Keep responses concise but informative for WhatsApp.
        - If you don't know something about a car not in the inventory, politely say you specialize in Mahindra's current lineup.
        `;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      model: "llama3-8b-8192",
    });

    return completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Can you try again?";
  } catch (error) {
    console.error("AI Service Error:", error);
    return "I'm having a bit of trouble thinking right now. Please try again in a moment.";
  }
};
