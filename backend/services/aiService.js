// Version 2.1.1 - NUCLEAR MARKDOWN BAN + Language Parity
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
XUV700: 200PS, 5-Star, Skyroof, ADAS. NO CNG.
SCORPIO-N: 203PS, 5-Star, 4x4. NO CNG.
THAR: 226mm GC, 650mm Water Wading, 4x4. NO CNG.
XUV 3XO: 5-Star, ADAS. NO CNG.
BOLERO/NEO: Rugged Diesel. NO CNG.
XUV400 EV: Electric, 456km range. NO CNG.
MARAZZO: Diesel. NO CNG.
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
      ? "🚨 AUDIO MODE: REPLY IN ROMAN SCRIPT ONLY. NEVER USE हिंदी SCRIPT. NEVER USE DEVANAGARI." 
      : "🚨 TEXT MODE: MIRROR USER SCRIPT EXACTLY (Hindi -> Hindi Script, Hinglish -> Roman, English -> English).";

    const systemPrompt = `
### 🤖 IDENTITY:
Mahindra Product Expert. PURE TEXT ONLY.

### 🚫 NUCLEAR BAN ON SYMBOLS (CRITICAL):
- **NO STARS**: Zero '*' characters allowed in response.
- **NO HASHES**: Zero '#' characters allowed in response.
- **NO BOLDING**: Do not use bold tags.
- **NO BULLET POINTS WITH SIGNS**: Use only EMOJIS (💰, 🛡️, 🚀, 📊, 💺) for bullets.
- **NO NUMBERING**: Do not use 1, 2, 3 numbering for car details.
- **NO FLUFF**: No "Namaste", no "Mahindra expert" talk, no introductory headers. JUST THE DATA.

### 🏁 SCRIPT RULES:
${scriptForce}
- Treat each query as independent. No language carry-over.

### 🚀 OUTPUT FORMAT:
Mahindra [Car Name] 🚗
💰 Price: [Range]
⛽ Fuel: [Specs]
📊 Mileage: [Specs]
💺 Seating: [Specs]

(Safety/Features/EMI only if specifically asked.)

### EMI FORMAT:
🏦 EMI: [Car]
💰 Price: [Price]
📈 Interest: 9.5% for 5yr
📉 Monthly: [Amt] monthly.

DATA:
INVENTORY: ${carInventory}
KNOWLEDGE: ${MAHINDRA_KNOWLEDGE}
CONTEXT: ${session.data.carModel || "General Mahindra"}
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
