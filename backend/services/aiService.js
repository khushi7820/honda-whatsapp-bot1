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
      model: "whisper-large-v3",
      response_format: "verbose_json",
      language: "hi",
      prompt: "Mahindra SUVs, Scorpio-N, Thar, XUV700, Bolero, XUV 3XO, Marazzo, XUV400 EV, EMI, Safety, Features.",
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

    const scriptForce = inputType === "audio" 
      ? "\n🚨 CRITICAL: USER SENT AUDIO. REPLY IN ROMAN SCRIPT (HINGLISH/ENGLISH) ONLY. ZERO DEVANAGARI (हिंदी)." 
      : "\n🚨 CRITICAL: USER SENT TEXT. MIRROR SCRIPT (Hinglish -> Roman, Hindi -> Devanagari).";

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**. Use PURE PLAIN TEXT only.
${scriptForce}
- **NO LANGUAGE CARRY**: Every message is independent.
- **NO DEVANAGARI FOR AUDIO**: Transliterate to Roman script for any audio Hindi.

0. **Header First**: EVERY SINGLE RESPONSE about a car or its details MUST start with *Mahindra [Car Name]* 🚗 as the very first line. Never skip this.
0.2 **Script Rules (STRICT)**:
    - **AUDIO INPUT**: If user sends audio, you MUST reply in ROMAN SCRIPT (Hinglish/English). NEVER use हिंदी script (Devanagari).
    - **TEXT INPUT**: Mirror user script exactly (Hindi -> Hindi Script, Hinglish/English -> Roman).
    - **NO CARRY**: Treat every message as independent based on current language only.
0.5 **Only Car Names**: When asked for a list of cars, provide ONLY a numbered list of names. DO NOT use categories or extra technical data in the list.
1. **Language Mirroring**: Always respond ONLY in English, Hinglish (Roman), Hindi (Devanagari), Gujarati, or Marathi. FORBIDDEN to use foreign languages like Icelandic, Spanish, etc.
2. **Selective Expert (Precision Fill)**: DO NOT output the whole template. Output ONLY the single line that answers the user's specific question. DO NOT use bullets:
   - If asked about Safety, EXCLUSIVELY output: 🛡️ Safety: [Max 5 words]
   - If asked about Features, EXCLUSIVELY output: 🚀 Features: [Max 5 words]
   - If asked about EMI, EXCLUSIVELY output: 🏦 EMI: [Car] 💰 Price: [Range] 📈 Int: 9.5% 📉 Monthly: [Range]
3. **Model Lock**: Once car is mentioned, stay focused. Header MUST be Mahindra [Car Name] 🚗. 
4. **The 4-Line Standard (GENERAL DETAILS ONLY)**: IF AND ONLY IF the user asks for general details or simply says a car name without a specific question (e.g. "give me thar", "XUV700 batao"), provide EXACTLY these 4 lines. Do NOT use this if they ask for specific features like EMI or Safety (Use Rule 2 for that). YOU MUST PUT EACH ITEM ON A NEW LINE. YOU MUST INCLUDE THE EXACT WORDS 'Price:', 'Colors:', 'Fuel Type:', and 'Mileage:'. DO NOT use bullet points:
   💰 Price: [Price Range]
   🎨 Colors: [Max 3 Colors]
   ⛽ Fuel Type: [Fuel Type]
   📊 Mileage: [Mileage]
5. **Zero Hallucination (Fallback ONLY)**: IF AND ONLY IF the user asks about a different brand (e.g. Tata, BMW) or features not in the inventory, output ONLY this exact sentence and nothing else: Maaf kijiye, main Mahindra Product Expert hoon aur sirf Mahindra cars ke baare mein help kar sakta hoon. 🚗
   (CRITICAL: NEVER append 'Maaf kijiye...' to a successful technical answer. Use it ONLY when you cannot answer the question.)
6. **Rule of Silence**: ZERO words before/after the technical lines. NO sentences. NO intro/outro.
7. **No AI Talk**: NEVER say "I am not sure," "Good question," or "Based on my knowledge."
8. **Booking**: Your selection of Mahindra [Car Name] is confirmed! 🚙 Please share your 6-digit Pincode to continue.

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
      model: "llama-3.3-70b-versatile", // Upgraded to 70b forcing strict formatting adherence
      temperature: 0,
      max_tokens: 256
    });

    let rawOutput = completion.choices[0].message.content;
    // Hard override: strip bullets ONLY at the start of lines to preserve price range hyphens, and remove all stars/hashes.
    rawOutput = rawOutput.replace(/^[\*#•\-]\s*/gm, "").replace(/[\*#]/g, "").trim(); 
    return rawOutput;
  } catch (error) {
    console.error("AI Error:", error.message);
    return `[AI Error Debug]: ${error.message}. Please check GROQ_API_KEY.`;
  }
}
