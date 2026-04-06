// Version 1.1.72 - Vercel Optimized (Restored Car Header)
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
### 📝 HINGLISH PRIMARY PROTOCOL:
- **Language**: Your default language is **HINGLISH** (Hindi mixed with English terms).
- **Direct Answer Only**: No greetings (except first 'Hi'). No extra fluff.

### 🚗 RULES:
1. **General Query (List of Cars)**: If the user asks for cars in general, show ONLY a numbered list of names.
   - Example (Hinglish): "Humare paas ye Mahindra gaadiyan hain: 1. XUV700, 2. Scorpio-N, 3. Thar..."
2. **Specific Car Query**: For specific cars, you MUST start with the car name in bold as a header, followed by the 4-line summary:
   *Mahindra [Car Name]* 🚗
   💰 **Price**: [Price]
   🎨 **Colors**: [Colors]
   ⛽ **Fuel**: [Fuel]
   📊 **Mileage**: [Mileage]
3. **Booking**: If booking/price is mentioned, ask ONLY for their 6-digit pincode in HINGLISH.
4. **No Fluff**: No intro like "Mahindra XUV700 ki details niche hain". Start directly with the header.

### 🏦 INVENTORY:
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `History:\n${history}\n\nLATEST USER QUESTION: ${userMessage}` }
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
