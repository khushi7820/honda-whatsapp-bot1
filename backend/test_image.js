import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://api.11za.in/apis/sendMessage/sendMessages";

async function testImage() {
  const to = "917820870519"; 
  const imageUrl = "https://images.livemint.com/img/2021/08/15/600x338/Mahindra_XUV700_1629007328906_1629007335198.jpg";
  
  const payload = {
    authToken: process.env.ZA_TOKEN,
    sendto: to,
    text: "Here is your Mahindra SUV!",
    originWebsite: process.env.ZA_ORIGIN,
    contentType: "image",
    mediaUrl: imageUrl
  };

  console.log("Testing 11za Image with payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(API_URL, payload);
    console.log("Response Status:", response.status);
    console.log("Response Data:", response.data);
  } catch (err) {
    console.error("11za Error Status:", err.response?.status);
    console.error("11za Error Data:", err.response?.data);
  }
}

testImage();
