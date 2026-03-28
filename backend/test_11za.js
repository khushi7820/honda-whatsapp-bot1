import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

async function test11za() {
  const to = "919714399793"; // User's number from screenshot (estimated)
  const text = "Local test message from 11za script";
  
  const payload = {
    authToken: process.env.ZA_TOKEN,
    sendto: to,
    text: text,
    originWebsite: process.env.ZA_ORIGIN,
    contentType: "text"
  };

  console.log("Testing 11za with payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(API_URL, payload);
    console.log("Response Status:", response.status);
    console.log("Response Data:", response.data);
  } catch (err) {
    console.error("11za Error Status:", err.response?.status);
    console.error("11za Error Data:", err.response?.data);
    console.error("Full Error:", err.message);
  }
}

test11za();
