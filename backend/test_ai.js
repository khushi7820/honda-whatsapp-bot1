import { getAIResponse } from "./services/aiService.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

async function testAI() {
  await connectDB();
  console.log("Testing AI response for 'hello'...");
  try {
    const response = await getAIResponse("Tell me about Thar", "");
    console.log("AI Response:", response);
  } catch (err) {
    console.error("AI Error:", err);
  }
}

testAI();
