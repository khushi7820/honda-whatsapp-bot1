// Version 1.1.68 - Vercel Optimized (Corrected Audio)
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
        const cars = await Car.find({}).lean(); 
        cachedInventory = cars.map(car => (
            `CAR: ${car.name}
PRICE: ${car.price}
FUEL: ${car.fuelType}
MILEAGE: ${car.mileage}
COLORS: ${car.colors ? car.colors.join(", ") : "Premium Colors Available"}
SAFETY: 4-5 Star Global NCAP Rating, ABS, EBD, Dual Airbags.
FEATURES: ${car.features ? car.features.join(", ") : "Fully Loaded with Tech"}`
        )).join("\n\n---\n\n");
        lastCacheUpdate = now;
        return cachedInventory;
    } catch (e) { return ""; }
}

export async function transcribeAudio(buffer) {
  // ⚡ CRITICAL: Use /tmp for Vercel write access 
  const tDir = process.env.VERCEL ? "/tmp" : process.cwd();
  const tempPath = path.join(tDir, `audio_${Date.now()}.ogg`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3-turbo",
      response_format: "text",
    });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    // ⚡ Return text property of the response
    return transcription.text || transcription;
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error("Transcription Error:", error.message);
    return "(Audio Error)";
  }
}

export async function getAIResponse(userMessage, history, baseUrl, session, inputType = "text") {
  try {
    const carInventory = await getInventory();

    const systemPrompt = `
You are the PRESTIGIOUS MAHINDRA VIRTUAL SPECIALIST. 👑
Your role is to guide users to their dream Mahindra SUV with absolute precision and class.

### 📜 CORE PROTOCOLS:
1. **Language Mirroring**: Always respond in the EXACT language the user uses (English or Hinglish). If the user speaks in Hinglish, you MUST reply in Hinglish. 
2. **Model Lock**: Once a user asks about a specific SUV (e.g., Thar, XUV700), stay focused on that model. Show its details and guide them to book a test drive for it.
3. **The 4-Line Standard**: When sharing car details, ONLY show these 4 lines:
   💰 *[Price Range]*
   🎨 *[Colors]*
   ⛽ *[Fuel Type]*
   📊 *[Mileage]*
   (STOP HERE. No fluff, no extra text, no safety/features unless asked.)
4. **Pivot Specialist**: If the user asks about ANY other brand (Maruti, Tata, Honda):
   - Give a ONE-WORD answer (e.g., "Tata?", "Maruti?").
   - Immediately pivot: "Anyway, let's get back to your Mahindra adventure. Which SUV are you eyeing today?"
5. **Frictionless Booking**: After a user selects/confirms a car, strictly say:
   "Your selection of *[Car Name]* is confirmed! 🚙 Please share your 6-digit Pincode to continue."
   (Do NOT share links, do NOT add conversational fluff.)

### 🏦 INVENTORY KNOWLEDGE:
${carInventory}

### 🎭 PERSONALITY:
Concise, Premium, Fast, and Sales-Driven. Avoid "I am an AI," "As a specialist," or "6-7 seater" fillers.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: userMessage }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3-70b-8192", // Using a larger model for better precision and language mirroring
      temperature: 0.2,
      max_tokens: 400
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error.message);
    return "Your selection is confirmed! Please share your 6-digit pincode to continue.";
  }
}
