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
### 📝 RULES:
1. **Mandatory Intro Line**: EVERY response must start with a single line describing the request. 
   - Examples: "6-7 seater gaadiyan aapke budget mein ye hain:", "Mahindra XUV700 ki complete detail ye rahi:", "10 Lakh ke andar Mahindra SUVs ye hain:".
   - Mirror the user's language for this line.
2. **Header**: After the intro, always use *Mahindra [Car Name]* 🚗 on its own line.
3. **Accurate Budget Matching**: Suggest ONLY cars that stay within the user's mentioned price. Never suggest a car above their budget.
4. **The 4-Line Summary (CARS ONLY)**: Use the 4-line emoji format ONLY for physical cars from the inventory.
   - NEVER use this format for names like "Booking", "Process", or "Help".
   - NEVER show "N/A" or "0.00 Lakh".
   - If user asks about booking, give 1-line text instruction only.
5. **No Duplication**: Do NOT repeat info in multiple lines.
6. **Mirror Language**: 100% Gujarati if user speaks Gujarati. Hinglish for Hindi/Audio.
7. **Booking**: If booking is mentioned, respond in the user's language: 
   - "Booking simple hai! Bus apna 6-digit Pincode yahan share karein. 🚙"
8. **No Fluff**: Start directly with the intro line. No "I am a Mahindra expert".
9. **Strict Focus**: Answer ONLY the current question. Zero history leakage.
10. **Strictly No Follow-ups**: Answer and stop.
11. **Pivoting**: One-word answer for other brands, then return to Mahindra.

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
