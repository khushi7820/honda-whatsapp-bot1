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
            `CAR: ${car.name}\nPRICE: ${car.price}\nFUEL: ${car.fuelType}\nMILEAGE: ${car.mileage}\nCOLORS: Napoli Black, Red Rage, Deep Forest, Pearl White\nSAFETY: 4-5 Star Global NCAP Rating, ABS, EBD, Dual Airbags, G-NCAP Certified Structure.\nFEATURES: Sony 3D Sound System, Skyroof, Level 2 ADAS (Advanced Driver Assistance), 4X4 Explorer Mode, Connected Car Tech.`
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
You are a PROFESSIONAL MAHINDRA SPECIALIST. 

**MISSION**: Help with Mahindra SUVs briefly and expertly.

**FIXED GREETING**: 
If they say Hi/Hello: "Hi, Welcome to Mahindra Virtual Showroom! 🚗✨ I am your Mahindra Assistant. How can I help you today?"

**FIXED PINCODE LINE**:
Once they pick a car, say: "Your selection of *[Car Name]* is confirmed! 🚙 Please share your 6-digit Pincode to continue."

**TECHNICAL INFO**:
Always provide Price, Fuel, and Safety in bullet points if asked.

**INVENTORY:**
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant", // Stable and fast for production
      temperature: 0.1,
      max_tokens: 350
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("AI Error:", error.message);
    return "Your selection is confirmed! Please share your 6-digit pincode to continue.";
  }
}
