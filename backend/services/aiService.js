// Version 2.1.0 - ULTRA-STRICT LANGUAGE & SCRIPT CONTROL
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
SEATING: ${car.seatingCapacity || "N/A"}
TYPE: ${car.type || "SUV"}
MILEAGE: ${car.mileage}
COLORS: ${car.colors ? car.colors.join(", ") : "Premium Colors Available"}
SAFETY: 4-5 Star Global NCAP Rating, ABS, EBD, Dual Airbags.
FEATURES: ${car.features ? car.features.join(", ") : "Fully Loaded"}`
    )).join("\n\n---\n\n");
    lastCacheUpdate = now;
    return cachedInventory;
  } catch (e) { return ""; }
}

const MAHINDRA_KNOWLEDGE = `
MAHINDRA XUV700: 200 PS, 5-Star Safety, Skyroof, ADAS. NO CNG.
MAHINDRA SCORPIO-N: 203 PS, 5-Star Safety, 4x4. NO CNG.
MAHINDRA THAR: 226mm GC, 650mm Water Wading, 4x4. NO CNG.
MAHINDRA XUV 3XO: 5-Star Safety, ADAS, Best mileage. NO CNG.
MAHINDRA BOLERO/NEO: Rugged Diesel. 7-Seater. NO CNG.
MAHINDRA XUV400 EV: Electric, 456 km range. NO CNG.
MAHINDRA MARAZZO: Diesel MPV. 4-Star Safety. NO CNG.
(Full technical depth for engine, price, variants, features is active).
`;

export async function transcribeAudio(buffer, ext = "ogg") {
  const tDir = process.env.VERCEL ? "/tmp" : process.cwd();
  const tempPath = path.join(tDir, `audio_${Date.now()}.${ext}`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      language: "hi", 
      prompt: "Transcribe accurately.",
    });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return transcription.text || "(Audio Empty)";
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return "(Audio Error)";
  }
}

export async function getAIResponse(userMessage, history, baseUrl, session, inputType = "text") {
  try {
    const carInventory = await getInventory();

    const scriptForce = inputType === "audio" 
      ? "🚨 FOR AUDIO INPUT: REPLY IN ROMAN SCRIPT ONLY (HINGLISH/ENGLISH). NEVER USE DEVANAGARI (हिंदी)." 
      : "🚨 FOR TEXT INPUT: MIRROR USER SCRIPT (Hindi Text -> Hindi Script, Hinglish -> Roman, English -> English).";

    const systemPrompt = `
### 🤖 IDENTITY:
You are the **Mahindra Product Expert**. 

### 📜 CRITICAL SCRIPT RULES (STRICT):
${scriptForce}
- **NO DEVANAGARI FOR AUDIO**: If user speaks Hindi/Hinglish, you reply in Roman (e.g., 'Aapka swagat hai').
- **NO LANGUAGE CARRY**: Treat every message independently based on its specific language.
- **NO FLUFF**: NEVER explain your process. NEVER say "I am a Mahindra expert". NEVER use "###". Just give the direct answer.
- **NO MARKDOWN**: NO stars (*), NO hashes (#), NO bolding.

### 🏁 SALES RULES:
1. **Ultra-Concise**: Default overview is ONLY 4-lines (Price, Fuel, Mileage, Seating). 
2. **On-Demand ONLY**: Show Safety, Features, or EMI ONLY if specifically asked in current message.
3. **EMI (On-Demand)**: Use 4-line format: 🏦 EMI: [Car] | 💰 Price: [Range] | 📈 Interest: 9.5% for 5yr | 📉 Monthly: [Amt].

### 🚀 CONVERSATION FLOW:
- **Model Overview**: 
  Mahindra [Car Name] 🚗
  💰 Price: [Range]
  ⛽ Fuel: [Specs]
  📊 Mileage: [Specs]
  💺 Seating: [Specs]

DATA:
INVENTORY: ${carInventory}
KNOWLEDGE: ${MAHINDRA_KNOWLEDGE}
CONTEXT: ${session.data.carModel || "General Mahindra"}
(Treat message independently. Follow language of current input.)
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `LATEST USER INPUT: ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 512
    });

    return completion.choices[0].message.content;
  } catch (error) {
    return `[AI Error]: ${error.message}`;
  }
}
