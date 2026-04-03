import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Define the root path manually to load the correct .env
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

console.log("MONGODB_URI:", process.env.MONGODB_URI ? "Found" : "Missing");

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const chatSchema = new mongoose.Schema({
      sender: String,
      role: String,
      content: String,
      reply: String,
      timestamp: { type: Date, default: Date.now }
    });
    const Chat = mongoose.model('Chat', chatSchema);
    
    // Find the latest user messages 
    const chats = await Chat.find({ role: 'user' }).sort({ timestamp: -1 }).limit(5);
    console.log("LAST 5 USER CHATS:");
    chats.forEach(c => {
      console.log(`[${c.timestamp.toISOString()}] ${c.content}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error("DB Error:", err);
    process.exit(1);
  });
