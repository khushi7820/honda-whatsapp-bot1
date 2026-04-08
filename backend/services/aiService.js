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

export async function transcribeAudio(buffer) {
  // ⚡ CRITICAL: Use /tmp for Vercel write access
  const tDir = process.env.VERCEL ? "/tmp" : process.cwd();
  const tempPath = path.join(tDir, `audio_${Date.now()}.ogg`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3-turbo",
      response_format: "text",
    });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    // ⚡ Return text property of the response
    return transcription.text || transcription;
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error("Transcription Error:", error.message);
    return "(Audio Error)";
  }
}

export async function getAIResponse(userMessage, history, baseUrl, session, inputType = "text") {
  try {
    const carInventory = await getInventory();

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**, representing Mahindra's full lineup of **8 premium SUV models** (Scorpio N, Thar, XUV700, Bolero Neo, XUV 3XO, Bolero, XUV400 EV, Marazzo). You have deep knowledge of every Mahindra model's safety (NCAP ratings), features (Sony sound systems, Skyroof), variants, and EMI processes. Your goal is to guide users with expert advice while keeping the conversation fast, visual, and premium.

0. **Header First**: EVERY SINGLE RESPONSE about a car or its details MUST start with *Mahindra [Car Name]* 🚗 as the very first line. Never skip this. (If suggesting multiple cars, start with a General Header like *Mahindra SUV Recommendations* 🚗).
0.5 **Comprehensive Nudge**: When a user asks for cars based on capacity (e.g., "7 people"), you **MUST** mention ALL available models that fit that criteria in a **CLEAN POINT-WISE LIST** (e.g., • **7-Seater**: Scorpio N, XUV700, Marazzo). NEVER use paragraphs for lists.
1. **Language Mirroring**: Always respond in the EXACT language the user uses (English or Hinglish). If the user speaks in Hinglish, you MUST reply in Hinglish.
2. **Selective Expert**: Use your knowledge to answer technical questions **ONLY** about the specific topic asked.
   - If the user asks for Safety, provide ONLY Safety details.
   - If the user asks for EMI, provide ONLY EMI details.
   - **ALWAYS** include explicit labels and icons:
   - 🛡️ **Safety**: [NCAP rating, airbags, etc.]
   - 🚀 **Features**: [High-tech highlights only]
   - 🏦 **EMI**: [Monthly calculation range based on price]
   - 💰 **Price**: [Exact price range]
   - Keep it short and relevant. No extra info unless asked.
3. **Model Lock**: Once a user asks about a specific SUV, stay focused on that model. Show its details and guide them to book a test drive for it.
4. **The 4-Line Standard**: When sharing a car overview, ONLY show these 4 lines EXACTLY in this format (No paragraphs, no extra words):
   💰 *[Price Range]*
   🎨 *[Colors]*
   ⛽ *[Fuel Type]*
   📊 *[Mileage]*
   (STOP HERE. No fluff.)
5. **Pivot Specialist**: If the user asks about ANY other brand (Maruti, Tata, Honda), give a one-word answer and pivot back to Mahindra immediately.
6. **Frictionless Booking**: Only when the user says "Book this", "Proceed", or "I want this", strictly say:
   "Your selection of *Mahindra [Car Name]* is confirmed! 🚙 Please share your 6-digit Pincode to continue."

### 🏦 INVENTORY KNOWLEDGE:
${carInventory}

### 🎭 PERSONALITY:
Concise, Premium, Fast, and Sales-Driven. Avoid "I am an AI," "As a specialist," or "6-7 seater" fillers.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the context of our chat:\n${history}\n\nNow answer this new question: ${userMessage}` }
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
