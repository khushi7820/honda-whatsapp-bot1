import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const testGroq = async () => {
    try {
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
        
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: "hi" }],
            model: "llama-3.3-70b-versatile",
        });
        
        console.log("✅ Groq Connection Successful!", completion.choices[0]?.message?.content);
        process.exit(0);
    } catch (err) {
        console.error("❌ Groq Connection Failed:", err.message);
        process.exit(1);
    }
};

testGroq();
