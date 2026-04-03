import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connect using DB URI from .env
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    
    // We can define the schema inline
    const chatSchema = new mongoose.Schema({
      sender: String,
      role: String,
      content: String,
      reply: String,
      timestamp: { type: Date, default: Date.now }
    });
    const Chat = mongoose.model('Chat', chatSchema);
    
    const chats = await Chat.find().sort({ timestamp: -1 }).limit(10);
    console.log("LAST 10 CHATS:");
    chats.forEach(c => {
      console.log(`[${c.timestamp.toISOString()}] ${c.role}: ${c.content.substring(0, 50)}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error("DB Error:", err);
    process.exit(1);
  });
