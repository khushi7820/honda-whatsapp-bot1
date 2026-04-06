// Version 1.1.71 - Vercel Optimized (Ultra-Strict Hinglish & Recognition Fix)
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
      prompt: "Transcribe accurately (Hindi/English/Hinglish). If user says 'cars', 'colors', 'mileage', use those English words in transcription.",
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
- **Language**: Your default language is **HINGLISH** (Hindi words mixed with English terms like 'price', 'colors', 'booking', 'specs').
- **Recognition**: Listen carefully to what the user wants. If they ask for cars, show a list. If they ask for details, show details.
- **Tone**: Professional yet direct. NO extra greetings or long intros.

### 🚗 RULES:
1. **General Query (List of Cars)**: If the user says "cars dekhni hai", "kaunsi cars hain", "show cars", or "kaun koun si gadiyan hain", respond in HINGLISH with a numbered list only.
   - Example (Hinglish): "Humare paas ye Mahindra gaadiyan hain: 1. XUV700, 2. Scorpio-N, 3. Thar, 4. XUV 3XO..."
2. **Specific Car Query**: For specific cars (e.g., "Thar batao" or "XUV 3XO details"), use the 4-line summary:
   💰 **Price**: [Price]
   🎨 **Colors**: [Colors]
   ⛽ **Fuel**: [Fuel]
   📊 **Mileage**: [Mileage]
3. **Booking**: If they ask to book, price, or "confirm", ask ONLY for their 6-digit pincode in HINGLISH.
   - Example (Hinglish): "Booking process ke liye apna 6-digit pincode share karein."
4. **No Fluff**: Do NOT repeat the question. Do NOT add "Aapka swagat hai" every time. Just answer and stop.

### 🏦 INVENTORY:
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `PAST CONVERSATION HISTORY:\n${history}\n\nLATEST USER QUESTION (Recognize this correctly): ${userMessage}` }
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
    return `[AI Error]: Sorry, something went wrong.`;
  }
}
