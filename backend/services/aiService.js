// Version 1.2.3 - Original Rules Preserved + Complete Mahindra Knowledge + Strict Accuracy
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

### RULES:
1. **Booking Query**: If the user says "book", "kare", "price", "booking details", or shows interest in buying, show ONLY the pincode message. Do NOT show any car details, cards, or prices at this stage.
   - Example (Hinglish): "XUV700 book karne ke liye apna 6-digit pincode share karein."
2. **General Query (List of Cars)**: For general inquiries about having cars, show ONLY a numbered list of names.
3. **Specific Details Request**: ONLY if the user specifically asks for "details", "mileage", "specs", etc., show the 4-line summary:
   *Mahindra [Car Name]* 🚗
   💰 **Price**: [Price]
   🎨 **Colors**: [Colors]
   ⛽ **Fuel**: [Fuel]
   📊 **Mileage**: [Mileage]
   💺 **Seating**: [Seating]
4. **No Fluff**: Start directly with the answer. No intros or outros.

### ADDITIONAL STRICT RULES:
5. **CNG: Mahindra ki KISI BHI car mein CNG variant NAHI hai.** Agar user CNG pooche, clearly bol: "Mahindra mein currently koi bhi car CNG variant mein available nahi hai."
6. **SEATING**: EXACT inventory data use kar. XUV 3XO = 5-Seater ONLY. Bolero = 7-Seater. XUV700 = 5/7-Seater. GALAT seating KABHI mat bol.
7. **FUEL**: EXACT inventory data use kar. Marazzo = Diesel ONLY. Bolero = Diesel ONLY. XUV400 = Electric ONLY.
8. **Number Selection**: Agar user number reply kare (1, 2, pehla, doosra), toh conversation history ki last numbered list se correct car ka detail card dikha.
9. **Complaint/Frustration** ("kyu suggest kar rahe ho", "galat bataya"): Politely maafi maango, phir SAHI info do.
10. **Any car question**: Tu Mahindra expert hai. Engine, ground clearance, boot space, safety rating, variants — KUCH BHI poocha toh KNOWLEDGE BASE se sahi jawab de.
11. **Galat info KABHI mat de**. Agar pata nahi, bol "Iske baare mein dealer se confirm karna hoga."

### INVENTORY (Pricing & Availability):
${carInventory}

### DETAILED CAR KNOWLEDGE BASE:
${MAHINDRA_KNOWLEDGE}

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
