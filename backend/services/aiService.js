// Version 1.1.66 - Final Mahindra Specialist
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
  const tempPath = path.join(process.cwd(), `audio_${Date.now()}.ogg`);
  try {
    fs.writeFileSync(tempPath, buffer);
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3-turbo",
      response_format: "text",
    });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return transcription;
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return null;
  }
}

export async function getAIResponse(userMessage, history, baseUrl, session, inputType = "text") {
  try {
    const carInventory = await getInventory();

    const systemPrompt = `
You are a PROFESSIONAL MAHINDRA SPECIALIST. You know every screw, bolt, and safety feature of Mahindra SUVs.

**MISSION**: Answer user questions like an expert (technical, features, safety) but keep every response **SHORT & BULLETED**.

**RULE 1: BREVITY (MAX 5-6 LINES)**
- No long paragraphs. Use bullets (•) and emojis.
- Never repeat the same car details twice in a row.

**RULE 2: GREETING (IDLE)**
- If the user says "Hi/Hello," keep it professional: "Hi! Welcome to Mahindra. How can I help you? I can show lists, specifications, or book a test drive."
- DON'T ask for a pincode in the first greeting.

**RULE 3: BOOKING BYPASS (AFTER SELECTION)**
- Once a car is selected, use the format:
You're interested in booking the *[Car Name]* 🚗
• 💰 *Price:* [Price]
• 🎨 *Colors:* [Colors]
• ⛽ *Fuel:* [Fuel]
• 📊 *Mileage:* [Mileage]
👉 Please share your 6-digit pincode.

**INVENTORY DATABASE (USE THIS):**
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hi! Welcome to Mahindra. 🚗✨ I am your Mahindra Assistant. How can I help you today? I can show lists, specifications, or book a test drive." },
      { role: "user", content: "list of cars" },
      { role: "assistant", content: "*Mahindra SUV Models* 🚗✨\n\n• Scorpio N 🚙\n• Thar 🚙\n• XUV700 🌟\n• Bolero Neo 🚙\n• XUV 3XO 🎨\n• Bolero ⛽\n• XUV400 EV 📊\n• Marazzo 🚗\n\n👉 Which one are you interested in?" },
      { role: "user", content: userMessage }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile", 
      temperature: 0.1,
      max_tokens: 400
    });

    return completion.choices[0].message.content;
  } catch (error) {
    return "Hi, how can I help you with our Mahindra SUVs today?";
  }
}
