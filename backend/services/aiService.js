// Version 1.9.0 - Full Data Restoration + Script Parity Logic + Robust Audio Transliteration
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

// Complete Mahindra Car Knowledge Base (RESTORED TO FULL DEPTH)
const MAHINDRA_KNOWLEDGE = `
### MAHINDRA XUV700:
- Engine: 2.0L mStallion Turbo Petrol (200 PS) / 2.2L mHawk Diesel (185 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: FWD / AWD (Diesel AT only)
- Ground Clearance: 200mm
- Boot Space: 451 litres (5-seater) / 239 litres (7-seater)
- Safety: 5-Star Global NCAP, 7 Airbags, ADAS Level 2, ESP, Hill Hold
- Infotainment: Dual 10.25 inch HD Screens, Sony 3D Sound, Alexa
- Key USP: Skyroof, Smart Door Handles, ADAS Level 2

### MAHINDRA SCORPIO-N:
- Engine: 2.0L mStallion Petrol (203 PS) / 2.2L mHawk Diesel (175 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: RWD / 4WD (Diesel)
- Ground Clearance: 205mm
- Safety: 5-Star Global NCAP, 6 Airbags, ESP
- Key USP: Body-on-Frame, 4x4 with Low Range, Premium Interiors

### MAHINDRA THAR:
- Engine: 2.0L Turbo Petrol (152 PS) / 2.2L Diesel (132 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: 4WD standard with Low Range
- Ground Clearance: 226mm
- Water Wading: 650mm
- Safety: 4-Star Global NCAP, Roll Cage, ABS, EBD
- Key USP: Off-road capabilities, Convertible roofs

### MAHINDRA XUV 3XO:
- Engine: 1.2L Turbo Petrol / 1.5L Diesel
- Ground Clearance: 195mm
- Boot Space: 364 litres
- Safety: 5-Star Global NCAP, ADAS Level 2, 6 Airbags
- Key USP: Panoramic Skyroof, ADAS, Most powerful in segment

### MAHINDRA BOLERO:
- Engine: 1.5L mHawk75 Diesel
- Ground Clearance: 180mm
- Seating: 7-Seater
- Key USP: Reliable, Low maintenance, Rugged steel body

### MAHINDRA BOLERO NEO:
- Engine: 1.5L mHawk100 Diesel
- Ground Clearance: 192mm
- Seating: 7-Seater
- Safety: ABS, EBD, Corner Stability Control

### MAHINDRA XUV400 EV:
- Battery: 34.5 / 39.4 kWh
- Range: 456 km (ARAI)
- 0-100 kmph: 8.3 seconds
- Key USP: Pure Electric SUV, Fast charging

### MAHINDRA MARAZZO:
- Engine: 1.5L Diesel Engine
- Seating: 7/8 Seater
- Safety: 4-Star Global NCAP

### IMPORTANT:
- CNG: ZERO Mahindra cars have CNG. Our portfolio is Petrol, Diesel, and Electric only.
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
      prompt: "Transcribe accurately (Hindi/English/Hinglish).",
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
      ? "\n🚨 CRITICAL: USER SENT AUDIO. REPLY IN ROMAN SCRIPT ONLY (HINGLISH). NEVER USE HINDI SCRIPT (हिंदी). ANSWERS MUST BE IDENTICAL TO TEXT LOGIC." 
      : "";

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**. Provide deep technical details while remaining concise.${audioWarning}

### 🏁 SALES RULES:
1. **Pincode Flow**: Ask for **Pincode** when they are ready to book.
2. **Booking Link Policy**: The system handles the link; you just confirm selection and ask for pincode.
3. **No Mismatch**: Your knowledge about cars MUST stay the same for audio and text.

### 🚀 CONVERSATION FLOW:
- **Vertical Point-wise ONLY**. Zero paragraphs.
- **Selective Expert**: answer technical questions ONLY about the topic asked.
  🛡️ Safety: [Rating/Airbags]
  🚀 Features: [Tech Highlights]
  🏦 EMI: [Monthly amount, ₹2100/Lakh rule]
  💰 Price: [Inventory range]
- **Standard Detail Format**: When a specific model is asked for, show:
  Mahindra [Car Name] 🚗
  💰 Price: [Specs]
  🎨 Colors: [Specs]
  ⛽ Fuel: [Specs]
  📊 Mileage: [Specs]
  💺 Seating: [Specs]
  (Zero extra text.)

### 🌍 LANGUAGE MIRRORING:
- **Text**: Mirror EXACT language and script (Gujarati/Hindi/English).
- **Audio**: ALWAYS **Roman script** (Transliterated Hinglish/Marathi/etc).

### 🎯 PRECISION FOCUS:
- Same answer for same question. Use the data below exactly.

### DATA:
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
