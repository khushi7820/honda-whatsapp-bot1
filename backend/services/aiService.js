// Version 1.1.68 - Vercel Optimized (Corrected Audio)
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
  // ⚡ CRITICAL: Use /tmp for Vercel write access 
  const tDir = process.env.VERCEL ? "/tmp" : process.cwd();
  const tempPath = path.join(tDir, `audio_${Date.now()}.${ext}`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      language: "hi", // Default to Hindi for Indian users
      prompt: "Transcribe the audio accurately. The user might speak in Hindi, English, or Hinglish (Hindi mixed with English words like 'mileage', 'price', 'colors', 'specs').",
    });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    
    const resultText = transcription.text || "(Audio Empty)";
    console.log(`[AudioTranscription] Decoded (${ext}): "${resultText.trim()}"`);
    return resultText;
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error(`[AudioTranscription] Error (${ext}):`, error.message);
    return "(Audio Error)";
  }
}

export async function getAIResponse(userMessage, history, baseUrl, session, inputType = "text") {
  try {
    const carInventory = await getInventory();

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**. You represent Mahindra's 8 premium SUVs (Scorpio N, Thar, XUV700, Bolero Neo, XUV 3XO, Bolero, XUV400 EV, Marazzo).

### 📝 RULES:
1. **Header**: Always start with *Mahindra [Car Name]* 🚗 on the first line.
2. **Mirror Language**: If the user speaks Hinglish, reply in Hinglish.
3. **Technical Answers**: 
   - For specific questions (Safety, Features), use **bullet points** (•).
   - Max 2 points, max 15 words per point.
4. **The 4-Line Summary**: For car overviews, ALWAYS use this exact format with emojis:
   💰 *Price*: [Range]
   🎨 *Colors*: [Colors]
   ⛽ *Fuel*: [Fuel]
   📊 *Mileage*: [Mileage]
5. **Strictly No Follow-ups**: Zero questions to the user. Answer and stop.
6. **Pivoting**: One-word answer for other brands, then return to Mahindra.
7. **Booking**: If asked about booking, say: "Booking is simple! Just share your 6-digit Pincode right here. 🚙"

### 🏦 INVENTORY:
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `STRICT ORDER: Listen ONLY to the latest question. Ignore previous car models if the new question is about a DIFFERENT car.\n\nHistory:\n${history}\n\nLATEST QUESTION: ${userMessage}` }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant", // Ultra-stable and fast
      temperature: 0.1,
      max_tokens: 512
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error.message);
    return `[AI Error Debug]: ${error.message}. Please check GROQ_API_KEY.`;
  }
}
