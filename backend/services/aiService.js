// Version 2.0.1 - Bulletproof EMI + Full Data Restore
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
MAHINDRA XUV700:
- Engine: 2.0L mStallion Turbo Petrol (200 PS) / 2.2L mHawk Diesel (185 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: FWD / AWD (Diesel AT only)
- Variants: MX, AX3, AX5, AX7, AX7 L
- Ground Clearance: 200mm
- Boot Space: 451 litres (5-seater) / 239 litres (7-seater)
- Safety: 5-Star Global NCAP, 7 Airbags, ADAS Level 2, ESP, Hill Hold, 360 Camera
- Infotainment: Dual 10.25 inch HD Screens, Sony 3D Sound, Alexa
- Warranty: 3 years / unlimited km
- Key USP: ADAS Level 2, Skyroof, Smart Door Handles
- Fuel: Petrol & Diesel ONLY. NO CNG.

MAHINDRA SCORPIO-N:
- Engine: 2.0L mStallion Turbo Petrol (203 PS) / 2.2L mHawk Diesel (175 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: RWD / 4WD (Diesel MT/AT)
- Variants: Z2, Z4, Z6, Z8, Z8 L
- Ground Clearance: 205mm
- Boot Space: 460 litres
- Safety: 5-Star Global NCAP, 6 Airbags, ESP, Hill Descent
- Infotainment: 8 inch Touchscreen, Sony 3D Sound, Wireless Android Auto/Apple CarPlay
- Warranty: 3 years / unlimited km
- Key USP: 4x4 with Low Range, Body-on-Frame, Maximum Towing
- Fuel: Petrol & Diesel ONLY. NO CNG.

MAHINDRA THAR:
- Engine: 2.0L mStallion Turbo Petrol (152 PS) / 2.2L mHawk Diesel (132 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: 4WD with Low Range Transfer Case
- Ground Clearance: 226mm
- Approach Angle: 41.8 / Departure Angle: 36.1 / Water Wading: 650mm
- Safety: 4-Star Global NCAP, 2 Airbags, ABS, EBD, Roll Cage
- Infotainment: 7 inch Touchscreen, Android Auto/Apple CarPlay
- Warranty: 3 years / unlimited km
- Key USP: Iconic off-roader, Convertible roof, Washable interior
- Fuel: Petrol & Diesel ONLY. NO CNG.

MAHINDRA XUV 3XO:
- Engine: 1.2L mStallion Turbo Petrol (130 PS) / 1.5L mHawk Diesel (117 PS)
- Transmission: 6-speed MT / 6-speed AMT / 6-speed AT
- Ground Clearance: 195mm
- Boot Space: 364 litres
- Safety: 5-Star Global NCAP, ADAS Level 2, 6 Airbags, ESP
- Infotainment: 10.25 inch HD Touchscreen, Adrenox Connected
- Key USP: Panoramic Skyroof, ADAS Level 2, Most mileage in segment
- Seating: 5-SEATER ONLY.
- Fuel: Petrol & Diesel ONLY. NO CNG.

MAHINDRA BOLERO:
- Engine: 1.5L mHawk D70 Diesel (76 PS)
- Transmission: 5-speed MT ONLY
- Ground Clearance: 180mm
- Safety: ABS, EBD, Dual Airbags, Strong steel body
- Key USP: Rugged, Best resale, Low maintenance
- Seating: 7-Seater
- Fuel: DIESEL ONLY. NO Petrol. NO CNG.

MAHINDRA BOLERO NEO:
- Engine: 1.5L mHawk100 Diesel (100 PS)
- Transmission: 5-speed MT ONLY
- Ground Clearance: 192mm
- Boot Space: 370 litres
- Safety: ABS, EBD, Dual Airbags, CSC
- Infotainment: 7 inch Touchscreen, Android Auto/Apple CarPlay
- Key USP: Modern Bolero, SUV styling with MUV space
- Seating: 7-Seater
- Fuel: DIESEL ONLY. NO Petrol. NO CNG.

MAHINDRA XUV400 EV:
- Battery: 34.5 / 39.4 kWh
- Range: 456 km (ARAI)
- 0-100 kmph: 8.3 seconds
- Safety: 5-Star BNCAP, 6 Airbags, ESP
- Key USP: Pure Electric, Zero emissions, Fast charging
- Seating: 5-SEATER ONLY.
- Fuel: ELECTRIC ONLY. NO Petrol. NO Diesel. NO CNG.

MAHINDRA MARAZZO:
- Engine: 1.5L D15 Diesel (123 PS)
- Transmission: 6-speed MT ONLY
- Ground Clearance: 193mm
- Safety: 4-Star Global NCAP, Dual Airbags
- Infotainment: 7 inch Touchscreen, Android Auto/Apple CarPlay
- Key USP: Shark inspired design, MPV space
- Seating: 7/8-Seater
- Fuel: DIESEL ONLY. NO Petrol. NO CNG.

IMPORTANT FACTS:
- CNG: ZERO Mahindra cars come in CNG.
- All cars have 3 year / unlimited km warranty.
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
- **NO NUMBERING**: NEVER start a single car answer with "1.".
- **NO FORMULAS**: NEVER show mathematical formulas (e.g. EMI calculation steps).

### 🏁 SALES RULES:
1. **EMI Rule (STRICT)**: Provide ONLY a concise monthly amount using the standard RULE: ₹2100 × (Total Lakhs of car price). DO NOT explain the math. DO NOT mention interest rates. DO NOT mention banks.
   Example: 🏦 EMI: ₹21,000 - ₹35,000 monthly.
2. **Full Knowledge**: Use COMPLETE data below for Engine, Boot, Infotainment.
3. **Multi-Intent**: Answer ALL parts of a query.
4. **Format**: Vertical points ONLY. No paragraphs.

### 🚀 CONVERSATION FLOW:
- **Selective Expert**: Answer topics asked using ONLY these labels (No stars):
  🛡️ Safety: [Specs/NCAP]
  🚀 Features: [High-tech Highlights]
  🏦 EMI: [Concise range only. No fluff.]
  💰 Price: [Specs]
- **Model Standard**:
  Mahindra [Car Name] 🚗
  💰 Price: [Specs]
  🎨 Colors: [Specs]
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
