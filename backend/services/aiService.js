// Version 1.1.65 - Expert Knowledge & Conciseness 
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
            `CAR: ${car.name}\nPRICE: ${car.price}\nFUEL: ${car.fuelType}\nMILEAGE: ${car.mileage}\nSAFETY: 4-5 Star Global NCAP, ABS, EBD, Dual Airbags\nFEATURES: Sony 3D Sound, Skyroof, Level 2 ADAS, 4X4 Explorer Mode`
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
You are a professional Mahindra Sales Expert. You know EVERYTHING about Mahindra SUVs.

**GOAL**: Answer technical questions (Safety, Engine, Features) briefly and professionally using bullet points.

**RULE 1: BREVITY (MAX 4-5 LINES)**
- Never write paragraphs.
- Use emojis and bullet points (•).

**RULE 2: CAR DETAILS LAYOUT**
You're interested in booking the *[Car Name]* 🚗
• 💰 *Price:* [Price]
• 🎨 *Colors:* [Colors]
• ⛽ *Fuel:* [Fuel]
• 📊 *Mileage:* [Mileage]
👉 Please share your 6-digit pincode.

**INVENTORY KNOWLEDGE:**
${carInventory}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "list of cars" },
      { role: "assistant", content: "*Mahindra SUV Models* 🚗✨\n\n• Scorpio N 🚙\n• Thar 🚙\n• XUV700 🌟\n• Bolero Neo 🚙\n• XUV 3XO 🎨\n• Bolero ⛽\n• XUV400 EV 📊\n• Marazzo 🚗\n\n👉 Which one are you interested in?" },
      { role: "user", content: userMessage }
    ];

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile", // Use 70B for technical expert answers
      temperature: 0.0,
      max_tokens: 350
    });

    return completion.choices[0].message.content;
  } catch (error) {
    return "Please share your 6-digit pincode.";
  }
}
