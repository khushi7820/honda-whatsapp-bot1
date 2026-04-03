import Groq from "groq-sdk";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function test() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log("Checking API Key: ", process.env.GROQ_API_KEY ? "EXISTS" : "FAIL");

  // Create empty ogg file to see how it fails
  fs.writeFileSync("test_invalid.ogg", Buffer.from([0,0,0,0]));
  
  try {
     const t = await groq.audio.transcriptions.create({
       file: fs.createReadStream('test_invalid.ogg'),
       model: 'whisper-large-v3',
       response_format: 'verbose_json'
     });
     console.log("Success:", t);
  } catch (e) {
     console.log("Error:", e.message);
  }
}
test();
