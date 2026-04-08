// Version 1.6.1 - REAL EMI calculation (₹2100/Lakh rule) + NO STARS + Context v5
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
FEATURES: ${car.features ? car.features.join(", ") : "Fully Loaded with Tech"}`
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
- Variants: MX, AX3, AX5, AX7, AX7 L
- Ground Clearance: 200mm
- Boot Space: 451 litres (5-seater) / 239 litres (7-seater)
- Safety: 5-Star Global NCAP, 7 Airbags, ADAS Level 2, ESP, Hill Hold, 360 Camera
- Infotainment: Dual 10.25 inch HD Screens, Adrenox Connected, Sony 3D Sound, Alexa
- Warranty: 3 years / unlimited km
- Key USP: ADAS Level 2, Skyroof, Smart Door Handles
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA SCORPIO-N:
- Engine: 2.0L mStallion Turbo Petrol (203 PS) / 2.2L mHawk Diesel (175 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: RWD / 4WD (Diesel MT/AT)
- Variants: Z2, Z4, Z6, Z8, Z8 L
- Ground Clearance: 205mm
- Boot Space: 460 litres
- Body on Frame construction
- Safety: 5-Star Global NCAP, 6 Airbags, ESP, Hill Descent
- Infotainment: 8 inch Touchscreen, Sony 3D Sound, Wireless Android Auto/Apple CarPlay
- Warranty: 3 years / unlimited km
- Key USP: 4x4 with Low Range, Body-on-Frame, Maximum Towing
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA THAR:
- Engine: 2.0L mStallion Turbo Petrol (152 PS) / 2.2L mHawk Diesel (132 PS)
- Transmission: 6-speed MT / 6-speed AT
- Drivetrain: 4WD with Low Range Transfer Case
- Variants: AX (O), LX (Hard Top / Soft Top / Convertible)
- Ground Clearance: 226mm
- Approach Angle: 41.8 / Departure Angle: 36.1 / Water Wading: 650mm
- Safety: 4-Star Global NCAP, 2 Airbags, ABS, EBD, Roll Cage
- Infotainment: 7 inch Touchscreen, Android Auto/Apple CarPlay
- Warranty: 3 years / unlimited km
- Key USP: Iconic off-roader, Convertible roof, Washable interior, 4WD Low Range
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA XUV 3XO:
- Engine: 1.2L mStallion Turbo Petrol (130 PS) / 1.5L mHawk Diesel (117 PS)
- Transmission: 6-speed MT / 6-speed AMT / 6-speed AT
- Drivetrain: FWD ONLY
- Variants: MX1, MX2, MX3, AX5, AX7, AX7 L
- Ground Clearance: 195mm
- Boot Space: 364 litres
- Safety: 5-Star Global NCAP, ADAS Level 2, 6 Airbags, ESP
- Infotainment: 10.25 inch HD Touchscreen, Adrenox Connected
- Warranty: 3 years / unlimited km
- Key USP: Safest sub-4m SUV, ADAS Level 2, Panoramic Skyroof
- Seating: 5-SEATER ONLY. NOT 7 SEATER.
- Fuel: Petrol & Diesel ONLY. NO CNG.

### MAHINDRA BOLERO:
- Engine: 1.5L mHawk D70 Diesel (76 PS)
- Transmission: 5-speed MT ONLY
- Drivetrain: RWD
- Variants: B2, B4, B6, B6 (O)
- Ground Clearance: 180mm
- Safety: ABS, EBD, Dual Airbags, Strong steel body
- Warranty: 3 years / unlimited km
- Key USP: Most rugged, Best resale value, Low maintenance
- Seating: 7-Seater
- Fuel: DIESEL ONLY. NO Petrol. NO CNG.

### MAHINDRA BOLERO NEO:
- Engine: 1.5L mHawk100 Diesel (100 PS)
- Transmission: 5-speed MT ONLY
- Drivetrain: RWD
- Variants: N4, N8, N10, N10 (O)
- Ground Clearance: 192mm
- Boot Space: 370 litres
- Safety: ABS, EBD, Dual Airbags, ISOFIX, Corner Stability Control
- Infotainment: 7 inch Touchscreen, Android Auto/Apple CarPlay
- Warranty: 3 years / unlimited km
- Key USP: Modern Bolero, SUV styling with MUV space
- Seating: 7-Seater
- Fuel: DIESEL ONLY. NO Petrol. NO CNG.

### MAHINDRA XUV400 EV:
- Motor: Permanent Magnet Synchronous Motor (150 PS / 310 Nm)
- Battery: 34.5 kWh / 39.4 kWh
- Range: 375 km / 456 km ARAI certified
- Charging: DC Fast Charge 0-80% in 50 min
- Variants: EC, EC Pro, EL, EL Pro
- Ground Clearance: 186mm
- 0-100 kmph: 8.3 seconds
- Safety: 5-Star BNCAP, 6 Airbags, ESP, Hill Hold
- Warranty: 3 years vehicle / 8 years battery
- Key USP: Pure Electric, Zero emissions, Fast charging
- Seating: 5-SEATER ONLY.
- Fuel: ELECTRIC ONLY. NO Petrol. NO Diesel. NO CNG.

### MAHINDRA MARAZZO:
- Engine: 1.5L D15 Diesel (123 PS / 300 Nm)
- Transmission: 6-speed MT ONLY
- Drivetrain: FWD
- Variants: M2, M4, M6, M8
- Ground Clearance: 193mm
- Safety: 4-Star Global NCAP, Dual Airbags, ABS, EBD
- Infotainment: 7 inch Touchscreen, Android Auto/Apple CarPlay
- Warranty: 3 years / 1 lakh km
- Key USP: Shark inspired design, Quietest cabin, Best ride quality MPV
- Seating: 7/8-Seater
- Fuel: DIESEL ONLY. NO Petrol. NO CNG.

### IMPORTANT FACTS:
- CNG: NONE of the Mahindra cars come in CNG. ZERO. NAHI HAI.
- Mahindra does NOT make Hatchbacks or Sedans. ONLY SUVs, MPV, and EV.
- All Mahindra cars come with minimum 3 year warranty.
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

    const systemPrompt = `
### HINGLISH PRIMARY PROTOCOL:
- **Language**: Your default language is **HINGLISH**.

### 🏁 SALES INDEPENDENCE RULES:
1. **Zero Call-Back Rule**: Never say "Humare executive aapko call karenge" or "Wait for a call". This is a fully digital showroom. Everything happens via the direct booking link.
2. **Digital Booking Flow**: When the user is ready to book or test drive, ask for their **Pincode**. Once shared, provide the **Direct Test Drive Booking Link** where they can select a date and time independently. Do NOT ask for color, fuel, or other details in chat.
3. **The 4-Line Standard**: When sharing a car overview, ONLY show these 4 lines:
   💰 *[Price Range]*
   🎨 *[Colors]*
   ⛽ *[Fuel Type]*
   📊 *[Mileage]*
   (Stop here. No fluff.)

### 🤖 AI IDENTITY:
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**, representing Mahindra's full lineup of **8 premium SUV models** (Scorpio N, Thar, XUV700, Bolero Neo, XUV 3XO, Bolero, XUV400 EV, Marazzo). You have deep knowledge of every Mahindra model's safety (NCAP ratings), features (Sony sound systems, Skyroof), variants, and EMI processes. Your goal is to guide users with expert advice while keeping the conversation fast, visual, and premium.

### 🚀 CONVERSATION FLOW:
- **Vertical Point-wise ONLY**: Never use paragraphs or full sentences.
- **List Rule**: If the user asks for a category (e.g., "5 seater", "best car"), ONLY show a vertical numbered list of names.
- **Selective Expert**: Use your knowledge to answer technical questions **ONLY** about the specific topic asked.
  - If the user asks for Safety, provide ONLY Safety details with the 🛡️ label.
  - If the user asks for Features, provide ONLY high-tech highlights with the 🚀 label.
  - If the user asks for EMI, provide ONLY monthly calculation range with the 🏦 label.
  - If the user asks for Price, provide ONLY the exact price range with the 💰 label.
  - **Labels MUST look like this**:
    🛡️ Safety: [NCAP rating, airbags, etc.]
    🚀 Features: [High-tech highlights only]
    🏦 EMI: Monthly calculation range (Rule: Estimate ~₹2,100 per Lakh of car price for a 5-year tenure).
    💰 Price: Exact price range.
  - Keep it short and relevant. No extra info unless asked. Provide REALISTIC EMI based on the actual price of the specific model.
- **Numeric Selection**: If the user replies with a NUMBER (e.g., "1", "2", "3"), identify which car that number refers to from the previous message in history. Show ONLY that car's **Model Standard**.
- **Model Standard**: If a specific model is asked for (e.g., "XUV700 details"), show ONLY this vertical format:
  Mahindra [Car Name] 🚗
  💰 Price: [Specs]
  🎨 Colors: [Specs]
  ⛽ Fuel: [Specs]
  📊 Mileage: [Specs]
  💺 Seating: [Specs]
  (Zero extra text.)
- **No Extra Description**: Remove all "This is a rugged SUV..." or "4-seater..." hallucinated headers.
- **Booking Intent**: If the user shows interest in booking or test driving (e.g. "i want to book", "book kare"), say EXACTLY this:
  "Aapki *[CURRENT_CAR_NAME]* selection confirm ho gayi hai! 🚙 Pincode share karein taaki hum aapke paas ka dealership verify karke booking link bhej sakein."
  (Crucial: ONLY ask for the Pincode. Do NOT show links, dates, or placeholders like [User to select].)
- **Context Lock**: NEVER switch to a different model unless explicitly asked.

### 🎭 PERSONALITY:
Extremely concise, high-speed data provider. Zero fluff. Always remains context-aware.

### 🌍 LANGUAGE MIRRORING (CRITICAL):
- Always respond in the EXACT language/script the user uses (English, Hinglish, or Hindi Devanagari).

### 🎯 PRECISION FOCUS:
- **No Hallucinations**: Only use provided inventory data. If data is missing, say "Details coming soon."

### INVENTORY (Pricing & Availability):
${carInventory}

### DETAILED CAR KNOWLEDGE BASE:
${MAHINDRA_KNOWLEDGE}

### CURRENT CAR CONTEXT:
The user is currently interested in: ${session.data.carModel || "General Mahindra SUVs"}

### RECENT CONVERSATION:
${history || "No previous conversation."}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `LATEST USER QUESTION (Recognize intent carefully): ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 512
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error.message);
    return `[AI Error]: Something went wrong.`;
  }
}
