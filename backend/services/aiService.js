// Version 2.0.5 - ULTRA-CONCISE Mode
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

// FULL KNOWLEDGE BASE (LOCKED)
const MAHINDRA_KNOWLEDGE = `
MAHINDRA XUV700:
- Engine: 2.0L Petrol (200 PS) / 2.2L Diesel (185 PS)
- Variants: MX, AX3, AX5, AX7, AX7 L
- Ground Clearance: 200mm
- Boot Space: 451 litres
- Safety: 5-Star Global NCAP, 7 Airbags, ADAS Level 2
- Infotainment: Dual 10.25 inch HD Screens
- Key USP: Skyroof, ADAS Level 2

MAHINDRA SCORPIO-N:
- Engine: 2.0L Petrol (203 PS) / 2.2L Diesel (175 PS)
- Ground Clearance: 205mm
- Safety: 5-Star Global NCAP, 6 Airbags
- Key USP: 4x4 with Low Range, Body-on-Frame

MAHINDRA THAR:
- Engine: 2.0L Petrol (152 PS) / 2.2L Diesel (132 PS)
- Ground Clearance: 226mm
- Water Wading: 650mm
- Safety: 4-Star Global NCAP
- Key USP: Iconic off-roader, Convertible roof

MAHINDRA XUV 3XO:
- Safety: 5-Star Global NCAP, ADAS Level 2
- Key USP: Panoramic Skyroof, ADAS Level 2
- Seating: 5-SEATER ONLY.

MAHINDRA BOLERO / NEO:
- Diesel ONLY. 7-Seater. Rugged SUV.

MAHINDRA XUV400 EV:
- Range: 456 km. Pure Electric.

MAHINDRA MARAZZO:
- Diesel MPV. 4-Star Safety.
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

    const audioWarning = inputType === "audio" 
      ? "\n🚨 CRITICAL: USER SENT AUDIO. USE ROMAN SCRIPT ONLY (HINGLISH). NEVER USE HINDI SCRIPT (हिंदी)." 
      : "";

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**. Use PURE PLAIN TEXT only.

### 🚫 ABSOLUTE BAN ON MARKDOWN SYMBOLS:
- **NO STARS**: NEVER use '*' for bolding or lists.
- **NO HASHES**: NEVER use '#' in the response.
- **NO BOLDING**: NO TEXT should be bolded.

### 🏁 SALES RULES:
1. **Ultra-Concise Rule**: When a user selects a car (e.g., clicks a number or says "tell me about xuv700"), provide ONLY the basic **Model Standard** lines. 
2. **On-Demand Info**: DO NOT show Safety, Features, or EMI unless specifically asked by the user in the current message.
3. **EMI Format (On-Demand)**:
   🏦 EMI: [Car Name]
   💰 Price: [Price]
   📈 Interest: 9.5% for 5 years
   📉 Monthly: [Calculation] monthly.

### 🚀 CONVERSATION FLOW:
- **Model Standard** (ONLY show this if Safety/EMI/Features are NOT asked):
  Mahindra [Car Name] 🚗
  💰 Price: [Range]
  ⛽ Fuel: [Specs]
  📊 Mileage: [Specs]
  💺 Seating: [Specs]

### 🌍 LANGUAGE MIRRORING:
- **Text**: Mirror script.
- **Audio**: ALWAYS **Roman script**.

DATA:
INVENTORY: ${carInventory}
KNOWLEDGE: ${MAHINDRA_KNOWLEDGE}
CONTEXT: ${session.data.carModel || "General Mahindra"}
HISTORY: ${history || ""}
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
