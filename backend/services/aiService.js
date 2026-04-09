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

    const scriptRules = inputType === "audio"
      ? `    - **AUDIO INPUT RULES**:
      1. If user sends AUDIO in Hindi → Respond in Hinglish (Roman Hindi), NOT in Devanagari.
      2. If user sends AUDIO in English → Respond in English.
      3. If user sends AUDIO in Gujarati → Respond in Gujarati script natively.`
      : `    - **TEXT INPUT RULES**: Respond EXACTLY in the same language and script as the user. If they type Gujarati script, reply in Gujarati script. If they type Devanagari (Hindi), reply in Devanagari.`;

    const activeLang = session?.data?.detectedLanguage || "HINGLISH/ENGLISH";

    const systemPrompt = `
### 🤖 AI IDENTITY:
You are the **Mahindra Product Expert**. Use PURE PLAIN TEXT only.

0. **Header First**: EVERY SINGLE RESPONSE about a car or its details MUST start with *Mahindra [Car Name]* 🚗 as the very first line. Never skip this.
0.2 **Script & Language Rules (STRICT)**:
    - **STICKY LANGUAGE**: The current active session language is **${activeLang}**. You MUST respond in ${activeLang} even if the user's current message is a short word or number (like "ok", "yes", "2"), UNLESS they explicitly type a full sentence in a totally different language.
${scriptRules}
0.5 **Only Car Names**: When asked for a list of cars, provide ONLY a numbered list of names. DO NOT use categories or extra technical data in the list.
1. **Language Check**: Always respond ONLY in English, Hinglish (Roman), Hindi (Devanagari), Gujarati, or Marathi. FORBIDDEN to use foreign languages.
2. **Selective Expert (Precision Fill)**: DO NOT output the whole template. Output ONLY the single line that answers the user's specific question. DO NOT use bullets:
   - If asked about Safety, EXCLUSIVELY output: 🛡️ Safety: [Max 5 words]
   - If asked about Features, EXCLUSIVELY output: 🚀 Features: [Max 5 words]
   - If asked about EMI, EXCLUSIVELY output: 🏦 EMI: [Car] 💰 Price: [Range] 📈 Int: 9.5% 📉 Monthly: [Range]
3. **Model Lock**: Once car is mentioned, stay focused. Header MUST be Mahindra [Car Name] 🚗. 
4. **The 4-Line Standard (GENERAL DETAILS ONLY)**: IF AND ONLY IF the user asks for general details (or simply says a car name) WITHOUT mentioning 'specifications' or 'features', provide EXACTLY these 4 lines. YOU MUST PUT EACH ITEM ON A NEW LINE. YOU MUST INCLUDE THE EXACT WORDS 'Price:', 'Colors:', 'Fuel Type:', and 'Mileage:'. DO NOT use bullet points:
   💰 Price: [Price Range]
   🎨 Colors: [Max 3 Colors]
   ⛽ Fuel Type: [Fuel Type]
   📊 Mileage: [Mileage]
5. **Zero Hallucination (Fallback ONLY)**: IF AND ONLY IF the user asks about a different brand (e.g. Tata, BMW) or features not in the inventory, output ONLY this exact sentence and nothing else: Maaf kijiye, main Mahindra Product Expert hoon aur sirf Mahindra cars ke baare mein help kar sakta hoon. 🚗
   (CRITICAL: NEVER append 'Maaf kijiye...' to a successful technical answer. Use it ONLY when you cannot answer the question.)
6. **Rule of Silence**: ZERO words before/after the technical lines. NO sentences. NO intro/outro.
7. **No AI Talk**: NEVER say "I am not sure," "Good question," or "Based on my knowledge."
8. **Booking Request (STRICT)**: If the user asks to book a car, test drive, or asks for the booking process, YOU MUST EXCLUSIVELY ASK FOR THEIR PINCODE AGAIN. Do NOT check history to see if they already gave a pincode. ALWAYS ask for the pincode explicitly. Do not say "you already shared it" or "wait for executive".
   - In Hindi/English: "Your selection of Mahindra [Car Name] is confirmed! 🚙 Please share your 6-digit Pincode to continue."
   - In Gujarati: "તમારી પસંદગી Mahindra [Car Name] કન્ફર્મ છે! 🚙 કૃપા કરીને તમારો 6-આંકડાનો પિનકોડ શેર કરો."

9. **Specification/Feature Inquiry (CLARIFICATION)**: If the user specifically asks for 'specifications' or 'features' (or 'specs', 'details'):
   - DO NOT provide technical data immediately.
   - IF A CAR WAS ALREADY DISCUSSED (Check History): Ask if they want to continue with that specific car or choose a new one, and ask which feature they want.
     - Hinglish: "Aap kis Mahindra SUV ke specifications dekhna chahte hain? Kya hum [Mentioned Car Name] continue karein? Aur aapko specific kya jaanna hai (Price, Mileage, Safety, ya EMI)? 🚗"
     - Gujarati: "તમે કઈ Mahindra SUV ના સ્પષ્ટીકરણો જોવા માંગો છો? શું આપણે [Mentioned Car Name] ચાલુ રાખીએ? અને તમારે ખાસ શું જાણવું છે (Price, Mileage, Safety, EMI)? 🚗"
   - IF NO CAR HAS BEEN DISCUSSED YET: Ask which car and which feature.
     - Hinglish: "Aap kis Mahindra car ke specifications dekhna chahte hain? Aapko inmein se kya jaanna hai: Price, Mileage, Safety, ya EMI? 🚗"
     - Gujarati: "તમે કઈ Mahindra ગાડીના સ્પષ્ટીકરણો જોવા માંગો છો? તમારે આમાંથી શું જાણવું છે: Price, Mileage, Safety, અથવા EMI? 🚗"
   - (CRITICAL: Replace [Mentioned Car Name] with the actual car from context. If multiple, use the last one.)
   - Mirror language (${activeLang}). Rule 6 (Silence) does NOT apply.

### 🏦 INVENTORY KNOWLEDGE:
${carInventory}

### 🧠 DEEP TECHNICAL SPECS (USE FOR BOOT SPACE, CAMERA, SAFETY, EMI):
- Thar: 4-seater, 600L Boot, Rear Camera, 4-Star NCAP, 4x4, EMI 20k-30k.
- Scorpio-N: 7-seater, 460L Boot, Rear & Front Camera, 5-Star NCAP, EMI 25k-40k.
- XUV700: 5/7-seater, 240L Boot, 360-degree Camera, 5-Star NCAP, ADAS, EMI 30k-45k.
- XUV 3XO: 5-seater, 364L Boot, 360-degree Camera, 6 Airbags, ADAS, EMI 15k-25k.
- Bolero: 7-seater, 380L Boot, No Camera, 2 Airbags, Rugged, EMI 18k-22k.
- Bolero Neo: 7-seater, 384L Boot, Reverse Camera, 2 Airbags, EMI 20k-25k.
- Marazzo: 7/8-seater, 190L Boot, Rear Camera, 4-Star NCAP, EMI 22k-28k.
- XUV400 EV: 5-seater, 378L Boot, Rear Camera, 5-Star NCAP, Electric, EMI 26k-34k.

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
