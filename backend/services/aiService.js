// Version 1.9.2 - Final Clean State + Audio/Text Logic Parity
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

// Complete Mahindra Car Knowledge Base
const MAHINDRA_KNOWLEDGE = `
### MAHINDRA XUV700:
- Engine: 2.0L mStallion Turbo Petrol (200 PS) / 2.2L mHawk Diesel (185 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: FWD / AWD (Diesel AT only)
- Ground Clearance: 200mm
- Boot Space: 451 litres (5-seater) / 239 litres (7-seater)
- Safety: 5-Star Global NCAP, 7 Airbags, ADAS Level 2, ESP, Hill Hold, 360 Camera
- Infotainment: Dual 10.25 inch HD Screens, Sony 3D Sound, Alexa
- Warranty: 3 years / unlimited km
- Key USP: ADAS Level 2, Skyroof, Smart Door Handles
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA SCORPIO-N:
- Engine: 2.0L mStallion Turbo Petrol (203 PS) / 2.2L mHawk Diesel (175 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: RWD / 4WD (Diesel MT/AT)
- Ground Clearance: 205mm
- Boot Space: 460 litres
- Safety: 5-Star Global NCAP, 6 Airbags, ESP, Hill Descent
- Infotainment: 8 inch Touchscreen, Sony 3D Sound, Wireless Android Auto/Apple CarPlay
- Key USP: 4x4 Low Range, Body-on-Frame, Maximum Towing
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA THAR:
- Engine: 2.0L Turbo Petrol (152 PS) / 2.2L Diesel (132 PS)
- Ground Clearance: 226mm
- Water Wading: 650mm
- Safety: 4-Star Global NCAP, Roll Cage, ABS, EBD
- Key USP: Iconic off-roader, Convertible roof, Washable interior
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA XUV 3XO:
- Engine: 1.2L mStallion Turbo Petrol / 1.5L Diesel
- Ground Clearance: 195mm
- Boot Space: 364 litres
- Safety: 5-Star Global NCAP, ADAS Level 2, 6 Airbags, ESP
- Key USP: ADAS Level 2, Panoramic Skyroof, Dual Screen
- Seating: 5-SEATER ONLY.
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA BOLERO:
- Engine: 1.5L mHawk D70 Diesel
- Ground Clearance: 180mm
- Safety: ABS, EBD, Dual Airbags
- Key USP: Rugged, Best resale, Low maintenance
- Seating: 7-Seater
- Fuel: DIESEL ONLY. NO CNG.

### MAHINDRA BOLERO NEO:
- Engine: 1.5L mHawk100 Diesel
- Ground Clearance: 192mm
- Safety: ABS, EBD, Dual Airbags, CSC
- Key USP: Modern Bolero, SUV styling
- Seating: 7-Seater
- Fuel: DIESEL ONLY. NO CNG.

### MAHINDRA XUV400 EV:
- Battery: 34.5 kWh / 39.4 kWh
- Range: 456 km (ARAI)
- 0-100 kmph: 8.3 seconds
- Safety: 5-Star BNCAP, 6 Airbags, ESP
- Key USP: Pure Electric, Zero emissions, Fast charging
- Seating: 5-SEATER ONLY.
- Fuel: ELECTRIC ONLY. NO CNG.

### MAHINDRA MARAZZO:
- Engine: 1.5L D15 Diesel
- Ground Clearance: 193mm
- Safety: 4-Star Global NCAP
- Seating: 7/8-Seater
- Fuel: DIESEL ONLY. NO CNG.

### IMPORTANT FACTS:
- CNG: ZERO Mahindra cars come in CNG. None. Na.
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
      ? "\n🚨 CRITICAL: USER SENT AUDIO. YOUR LOGICAL ANSWER MUST BE 100% IDENTICAL TO A TEXT REPLY. THE ONLY DIFFERENCE IS SCRIPT. USE ROMAN SCRIPT ONLY (Transliterated Hinglish). NEVER USE HINDI SCRIPT (हिंदी)." 
      : "";

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**. Your primary mission is to provide 100% consistent data regardless of whether the user types or sends audio.${audioWarning}

### 🏁 SALES RULES:
1. **Consistency**: Use the EXACT same logic, price, and specs for audio and text.
2. **Pincode Flow**: Ask for **Pincode** when ready to book.
3. **Format**: Vertical points only. No markdown stars (*) for bolding.

### 🚀 CONVERSATION FLOW:
- **Selective Expert**: provide data ONLY for the topic asked:
  🛡️ Safety: [Specs]
  🚀 Features: [Specs]
  🏦 EMI: [Amount only, ₹2100/Lakh rule]
  💰 Price: [Specs]
- **Model Standard**: If a specific model is asked for, show ONLY this vertical format:
  Mahindra [Car Name] 🚗
  💰 Price: [Specs]
  🎨 Colors: [Specs]
  ⛽ Fuel: [Specs]
  📊 Mileage: [Specs]
  💺 Seating: [Specs]
  (Zero extra text.)

### 🌍 LANGUAGE MIRRORING:
- **Text**: Mirror EXACT language/script.
- **Audio**: ALWAYS **Roman script** (Hinglish/Transliterated).

### DATA BASE:
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
