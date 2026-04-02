// Version 1.1.64 - Fast Response Optimization (Zero Timeouts)
import Groq from "groq-sdk";
import dotenv from "dotenv";
import Car from "../models/Car.js";
import fs from "fs";
import path from "path";

dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Car Inventory Cache
let cachedInventory = "";
let lastCacheUpdate = 0;

async function getInventory() {
    const now = Date.now();
    if (cachedInventory && (now - lastCacheUpdate < 300000)) return cachedInventory; 
    try {
        const cars = await Car.find({}).lean(); // Use lean() for speed
        cachedInventory = cars.map(car => (car.name)).join(", "); 
        lastCacheUpdate = now;
        return cachedInventory;
    } catch (e) { return ""; }
}

export async function transcribeAudio(buffer) {
  const tempPath = path.join(process.cwd(), `audio_${Date.now()}.ogg`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3-turbo",
      response_format: "text",
    });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return transcription;
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return null;
  }
}

export async function getAIResponse(userMessage, history, baseUrl, session, inputType = "text") {
  try {
    const carInventory = await getInventory();

    const systemPrompt = `
You are a Mahindra Sales Assistant. YOU MUST BE SHORT. NO BULLSHIT.

**RULE 1: LISTS (NAMES ONLY)**
- Header: "*Mahindra SUV Models* 🚗✨"
• Scorpio N 🚙
• Thar 🚙
• XUV700 🌟
• Bolero Neo 🚙
• XUV 3XO 🎨
• Bolero ⛽
• XUV400 EV 📊
• Marazzo 🚗
👉 Which one are you interested in?

**RULE 2: CAR DETAILS (NO FEATURES)**
You're interested in booking the *[Car Name]* 🚗
• 💰 *Price:* [Price]
• 🎨 *Colors:* [Colors]
• ⛽ *Fuel:* [Fuel]
• 📊 *Mileage:* [Mileage]
👉 Please share your 6-digit pincode.

**INVENTORY:**
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "list of cars" },
      { role: "assistant", content: "*Mahindra SUV Models* 🚗✨\n\n• Scorpio N 🚙\n• Thar 🚙\n• XUV700 🌟\n• Bolero Neo 🚙\n• XUV 3XO 🎨\n• Bolero ⛽\n• XUV400 EV 📊\n• Marazzo 🚗\n\n👉 Which one are you interested in?" },
      { role: "user", content: userMessage }
    ];

    // Using 8B model for sub-second responses (Avoids Vercel Timeouts)
    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature: 0.0,
      max_tokens: 200 
    });

    return completion.choices[0].message.content;
  } catch (error) {
    return "Please share your 6-digit pincode.";
  }
}
