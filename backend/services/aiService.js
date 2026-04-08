// Version 1.9.9 - ABSOLUTE MARKDOWN BAN + Pure Text Output + Full Knowledge
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

// FULL KNOWLEDGE BASE (MAXIMUM DEPTH)
const MAHINDRA_KNOWLEDGE = `
### MAHINDRA XUV700:
- Engine: 2.0L mStallion Turbo Petrol (200 PS) / 2.2L mHawk Diesel (185 PS)
- Transmission: 6-speed MT / 6-speed AT
- Ground Clearance: 200mm
- Boot Space: 451 litres
- Safety: 5-Star Global NCAP, 7 Airbags, ADAS Level 2, ESP, 360 Camera
- Infotainment: Dual 10.25 inch HD Screens, Sony 3D Sound
- Key USP: Skyroof, Smart Door Handles, ADAS Level 2
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA SCORPIO-N:
- Engine: 2.0L Turbo Petrol (203 PS) / 2.2L Diesel (175 PS)
- Ground Clearance: 205mm
- Safety: 5-Star Global NCAP, 6 Airbags, ESP
- Key USP: 4x4 with Low Range, Body-on-Frame

### MAHINDRA THAR:
- Engine: 2.0L Petrol (152 PS) / 2.2L Diesel (132 PS)
- Ground Clearance: 226mm
- Water Wading: 650mm
- Safety: 4-Star Global NCAP
- Key USP: Iconic off-roader, Convertible roof

### MAHINDRA XUV 3XO:
- Safety: 5-Star Global NCAP, ADAS Level 2, 6 Airbags
- Key USP: Panoramic Skyroof, ADAS Level 2, Most mileage

### MAHINDRA BOLERO / NEO:
- Diesel ONLY. 7-Seater. Rugged SUV.

### MAHINDRA XUV400 EV:
- Range: 456 km. Pure Electric.

### MAHINDRA MARAZZO:
- Diesel MPV. 7/8 Seater. 4-Star Safety.

### IMPORTANT:
- NO Mahindra car has CNG.
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

### 🚫 ABSOLUTE BAN ON MARKDOWN:
- **NO STARS**: NEVER use '*' for bolding or lists.
- **NO HASHES**: NEVER use '#' for headers (e.g., no ###).
- **NO UNDERCORES**: NEVER use '_'.
- **NO BOLDING**: NO TEXT should be bolded.
- **NO INTRO HEADERS**: NEVER start with "### MAHINDRA XUV...".
- **NO NUMBERING**: NEVER start a single car answer with "1.".

### 🏁 SALES RULES:
1. **Multi-Intent Rule**: Answer ALL parts of a query. Label clearly: "Best Car: [Name]" (No stars).
2. **Clean List Rule**: For a "list of all cars", provide ONLY a vertical list of names. No specs.
3. **Format**: Vertical points ONLY.

### 🚀 CONVERSATION FLOW:
- **Selective Expert**: Answer asked topics using labels below.
  🛡️ Safety: [Specs]
  🚀 Features: [Specs]
  🏦 EMI: [Amount only]
  💰 Price: [Specs]
- **Model Standard** (MANDATORY FORMAT - NO MARKDOWN):
  Mahindra [Car Name] 🚗
  💰 Price: [Specs]
  🎨 Colors: [Specs]
  ⛽ Fuel: [Specs]
  📊 Mileage: [Specs]
  💺 Seating: [Specs]

### 🌍 LANGUAGE MIRRORING:
- **Text**: Mirror EXACT language/script.
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
