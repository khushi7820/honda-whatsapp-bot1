// Version 1.1.63 - Ultimate Names Only & Absolute Bypass
import Chat from "../models/Chat.js";
import Session from "../models/Session.js";
import Car from "../models/Car.js";
import { getAIResponse, transcribeAudio } from "../services/aiService.js";
import { sendMessage, sendImage, downloadMedia, sendAudio } from "../services/whatsappService.js";
import { generateTTS } from "../services/ttsService.js";
import { getBookButton, getDateListText, getSlotListText, getColorListText, getFuelListText } from "../utils/bookingTemplates.js";
import axios from "axios";
import { connectDB } from "../config/db.js";

let isConnected = false;
const ensureDB = async () => {
    if (!isConnected) { await connectDB(); isConnected = true; }
}

const processedMessages = new Set();

export async function handleWebhook(req, res) {
    try {
        await ensureDB();
        const body = req.body;
        let sender, type = "text", textRaw = "";
        const msgId = body.messageId || body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || body.id;

        // Extract sender early for msgKey
        if (body.from) sender = body.from;
        else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) sender = body.entry[0].changes[0].value.messages[0].from;
        else if (body.messages?.[0]) sender = body.messages[0].from;

        // Use msgId + sender for better deduplication
        const msgKey = `${msgId}_${sender || 'unknown'}`;
        if (msgId && processedMessages.has(msgKey)) return res.status(200).send("OK");
        if (msgId) {
            processedMessages.add(msgKey);
            setTimeout(() => processedMessages.delete(msgKey), 10000); // Shorter lock
        }

        let mId = msgId;
        let mediaUrlToDownload = null;

        if (body.from && body.content) {
            type = body.content.contentType?.toLowerCase() || "text";

            if (type === "text") {
                textRaw = body.content.text || "";
            } else if (type === "media") {
                mediaUrlToDownload = body.content.media?.url || null;
                const mediaType = body.content.media?.type;
                if (mediaType === "voice" || mediaType === "audio") {
                    type = "audio";
                }
            } else if (type === "audio" || type === "voice") {
                // Direct audio/voice contentType (not wrapped in "media")
                type = "audio";
                mediaUrlToDownload = body.content.media?.url || body.content.url || body.content.audio?.url || body.content.voice?.url || null;
            }
            if (body.content.mediaId) mId = body.content.mediaId;
        } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msgObj = body.entry[0].changes[0].value.messages[0];
            sender = msgObj.from;
            type = msgObj.type?.toLowerCase() || "text";
            mId = msgObj.audio?.id || msgObj.voice?.id || msgId;
            if (type === "text") textRaw = msgObj.text.body || "";
            if (msgObj.audio?.url) mediaUrlToDownload = msgObj.audio.url;
            if (msgObj.voice?.url) mediaUrlToDownload = msgObj.voice.url;
        } else if (body.messages?.[0]) {
            sender = body.messages[0].from;
            type = body.messages[0].type?.toLowerCase() || (body.messages[0].isAudio ? "audio" : "text");
            mId = body.messages[0].audio?.id || body.messages[0].voice?.id || msgId;
            textRaw = type === "text" ? (body.messages[0].text?.body || "") : "";
            if (body.messages[0].audio?.url) mediaUrlToDownload = body.messages[0].audio.url;
            if (body.messages[0].voice?.url) mediaUrlToDownload = body.messages[0].voice.url;
        }

        if (!sender) return res.status(200).send("OK");

        // STEP 1: GET OR CREATE SESSION
        let session = await Session.findOne({ sender });
        if (!session) {
            session = new Session({ sender, state: "IDLE", data: { history: [], carModel: null } });
            await session.save();
        }

        // STEP 1.5: ROBUST MEDIA EXTRACTION
        let mediaIdToDownload = mId;

        if (type !== "text") {
            try {
                let buffer = null;
                console.log(`[Media Debug] Attempting download for type: ${type}, URL: ${mediaUrlToDownload}, ID: ${mediaIdToDownload}`);

                // Prioritize direct downloadMedia tool which handles token and format detection
                if (mediaUrlToDownload) {
                    buffer = await downloadMedia(mediaUrlToDownload);
                } else if (mediaIdToDownload) {
                    buffer = await downloadMedia(mediaIdToDownload);
                }

                if (buffer && buffer.length > 100) {
                    textRaw = await transcribeAudio(buffer, "ogg");
                    console.log(`[BOT] Transcription Success: "${textRaw}"`);
                } else {
                    console.error("[BOT] Audio Fail - Buffer too small or empty");
                    // Tell user audio failed
                    const audioFailMsg = "Maaf kijiye, aapka audio sun nahi paaya. Kripaya dobara try karein ya text mein likhein. 🎤";
                    await sendMessage(sender, audioFailMsg);
                    await new Chat({ sender, role: "user", content: "(Audio - not processed)" }).save();
                    await new Chat({ sender, role: "assistant", reply: audioFailMsg, content: audioFailMsg }).save();
                    return res.status(200).send("OK");
                }
            } catch (err) {
                console.error("[BOT] Audio/STT Fatal Fail:", err.message);
                const audioFailMsg = "Maaf kijiye, aapka audio process nahi ho paaya. Kripaya text mein likhein. 🎤";
                await sendMessage(sender, audioFailMsg);
                await new Chat({ sender, role: "user", content: "(Audio Error)" }).save();
                await new Chat({ sender, role: "assistant", reply: audioFailMsg, content: audioFailMsg }).save();
                return res.status(200).send("OK");
            }
        }

        const lowerMsg = textRaw ? textRaw.toLowerCase().trim() : "";
        console.log(`[BOT] User Input: "${textRaw}" from ${sender}`);

        // 0. LANGUAGE DETECTION (Default to HINGLISH)
        if (!session.data.detectedLanguage || session.data.detectedLanguage === "ENGLISH") {
            if (/[\u0a80-\u0aff]/.test(textRaw)) session.data.detectedLanguage = "GUJARATI";
            else session.data.detectedLanguage = "HINGLISH";
            await session.save();
        } else if (/[\u0a80-\u0aff]/.test(textRaw)) {
            session.data.detectedLanguage = "GUJARATI";
            await session.save();
        } else {
            // Re-detect Hinglish just in case
            if (/hindi|bhai|kya|batao|ka|se|hai|hu|kaisa|apna|bolero|scorpio|xuv/i.test(lowerMsg)) {
                session.data.detectedLanguage = "HINGLISH";
                await session.save();
            }
        }

        // 0. GREETINGS BYPASS
        const greetingRegex = /\b(hi|hello|namaste|hey|hii|hy|hyy|heyy|hiii|naam|haa|hal|hoi)\b/i;
        const isBookingSearch = /(book|buy|interested|appointment|booking)/i.test(lowerMsg);

        if (greetingRegex.test(lowerMsg) && !isBookingSearch && lowerMsg.length < 15) {
            let welcomeMsg = "Hi, how can I help you with our Mahindra SUVs today? 🚗✨";
            if (session.data.detectedLanguage === "GUJARATI") {
                welcomeMsg = "Hi, how can I help you with our Mahindra SUVs today? 🚗✨";
            }
            await sendMessage(sender, welcomeMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: welcomeMsg, content: welcomeMsg }).save();
            return res.status(200).send("OK");
        }

        // 0.5 ACKNOWLEDGEMENT BYPASS
        const ackWords = /\b(ok|okay|kk|k|done|sweet|nice|thnx|thanks|thank you|shukriya|great|no thanks|no thank you|no|nahi|nhi|fine|achha|theek)\b/i;
        if (ackWords.test(lowerMsg) && lowerMsg.length < 12) {
            let ackReply = "Theek hai! Kya aap kisi aur Mahindra SUV ke baare mein jaan-na chahte hain? 🚗✨";
            if (session.data.detectedLanguage === "GUJARATI") {
                ackReply = "Dhanyavad! Shu tame biji koi Mahindra SUV vishe janva mangon cho? 🚗✨";
            }

            await sendMessage(sender, ackReply);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: ackReply, content: ackReply }).save();
            return res.status(200).send("OK");
        }

        // 0.8 FINAL WEB CONFIRMATION BYPASS
        if (lowerMsg.startsWith("confirm_booking:")) {
            const parts = textRaw.split(":");
            const details = parts[1]?.split("|") || [];
            const bookingDate = details[0]?.trim() || "Selected Date";
            const bookingTime = details[1]?.trim() || "Selected Time";
            const carName = session.data.carModel || "Mahindra SUV";
            const pincode = session.data.pincode || "Not Provided";
            const location = session.data.area || "Verified Area";

            const finalConfirmMsg = session.data.detectedLanguage === "GUJARATI"
                ? `✅ ટેસ્ટ ડ્રાઈવ કન્ફર્મ!\n\n🚗 ગાડી: ${carName}\n📅 તારીખ: ${bookingDate}\n🕓 સમય: ${bookingTime}\n📍 પિનકોડ: ${pincode}\n🏢 સ્થળ: ${location}\n\nઅમારા એક્ઝિક્યુટિવ ટૂંક સમયમાં તમારો સંપર્ક કરશે. ધન્યવાદ! 🙏`
                : `✅ Test Drive Confirmed!\n\n🚗 Car: ${carName}\n📅 Date: ${bookingDate}\n🕓 Time: ${bookingTime}\n📍 Pincode: ${pincode}\n🏢 Location: ${location}\n\nOur executive will call you shortly to finalize details. Thank you! 🙏`;

            // Admin Final Lead Alert
            await sendMessage("15558689519", `🎉 SUCCESSFUL BOOKING!\n👤 Client: ${sender}\n🚗 Car: ${carName}\n📅 Date: ${bookingDate}\n🕓 Time: ${bookingTime}\n📍 Pincode: ${pincode}\n🏢 Location: ${location}`);

            session.state = "IDLE"; await session.save();
            await sendMessage(sender, finalConfirmMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: finalConfirmMsg, content: finalConfirmMsg }).save();
            return res.status(200).send("OK");
        }

        // 1. PINCODE BYPASS (Auto-detect in Audio/Text)
        const cleanForPin = textRaw.replace(/[-.\s]+/g, "");
        const pincodeMatch = cleanForPin.match(/\d{6}/);
        if (pincodeMatch) {
            const pc = pincodeMatch[0];
            let city = "Verified Area";
            try {
                const pcRes = await axios.get(`https://api.postalpincode.in/pincode/${pc}`);
                if (pcRes.data[0]?.Status === "Success") {
                    const po = pcRes.data[0].PostOffice[0];
                    city = `${po.District}, ${po.State}`;
                }
            } catch (e) { }

            session.data.pincode = pc;
            session.data.area = city;

            const carName = session.data.carModel || "Mahindra SUV";
            const carId = carName.replace(/Mahindra\s+/i, "").toLowerCase().replace(/\s+/g, "-");
            const userPhone = sender.replace(/\D/g, "");
            const botPhone = "15558689519";

            const calendarUrl = `https://honda-whatsapp-bot1-paje.vercel.app/booking/calendar?carId=${carId}&phone=${userPhone}&botPhone=${botPhone}`;

            const pincodeMsg = session.data.detectedLanguage === "GUJARATI"
                ? `📍 પિનકોડ વેરિફાઈડ: ${pc}\n🏢 સ્થળ: ${city}\n\n✅ ટેસ્ટ ડ્રાઈવ સ્લોટ બુકિંગ!\n🚗 ગાડી: ${carName}\n\nકૃપા કરીને નીચેની લિંક પર ક્લિક કરીને તમારો સ્લોટ બુક કરો:\n📅 ${calendarUrl}\n\nધન્યવાદ! 🙏`
                : `📍 Pincode Verified: ${pc}\n🏢 Location: ${city}\n\n✅ Schedule Your Test Drive!\n🚗 Car: ${carName}\n\nPlease click the link below to select your date and time slot:\n📅 ${calendarUrl}\n\nThank you! 🙏`;

            // Lead Alert to Admin
            const leadAlert = `New Booking Intent! 🚀\n👤 Client: ${sender}\n🚗 Car: ${carName}\n📍 Area: ${city}\n📌 Pincode: ${pc}`;
            await sendMessage("15558689519", leadAlert);

            session.markModified('data');
            session.state = "IDLE"; await session.save();
            await sendMessage(sender, pincodeMsg);

            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: pincodeMsg, content: pincodeMsg }).save();
            return res.status(200).send("OK");
        }

        // 1B. CAR DETECTION & SELECTION HANDLING
        const numericMatch = lowerMsg.match(/^\s*(\d+)\s*/);
        const isRecommendationQuery = /looking|suggest|recommend|best|for\s\d+/i.test(lowerMsg);
        const isImageRequest = /image|photo|pic|img/i.test(lowerMsg);
        const isGeneralCarListQuery = /cars|gaadi|gadiyan|gaadiyan|models|inventory|available|kaunsi|kousi|dekhni|dikhao|list|price list/i.test(lowerMsg) && !isImageRequest && !/(xuv|scorpio|thar|bolero|marazzo|3xo|ev|400)/i.test(lowerMsg) && !/\b(seater|seat|petrol|diesel|electric|cng|ev)\b/i.test(lowerMsg) && !session.data.carModel;

        if (isRecommendationQuery) {
            session.data.carModel = null;
            await session.save();
        }

        const isCNGRequest = /\bcng\b/i.test(lowerMsg);
        if (isCNGRequest) {
            const cngMsg = session.data.detectedLanguage === "GUJARATI"
                ? `માફ કરજો, મહિન્દ્રા પાસે હાલ CNG ગાડીઓ ઉપલબ્ધ નથી. મહિન્દ્રા ફક્ત પેટ્રોલ, ડીઝલ અને ઇલેક્ટ્રિક SUV પ્રદાન કરે છે. 🚗`
                : `Maaf kijiye, Mahindra ke paas abhi CNG cars available nahi hain. Mahindra sirf Petrol, Diesel aur Electric SUVs provide karta hai. 🚗\n\nKya aap inmein se kisi ke baare mein jaan-na chahenge?`;

            await sendMessage(sender, cngMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: cngMsg, content: cngMsg }).save();
            return res.status(200).send("OK");
        }

        // 3A. SEATING CAPACITY FILTER BYPASS (Hardcoded - also checks fuel if mentioned)
        const allNumbers = lowerMsg.match(/\d+/g);
        const seatKeywords = /seater|seat|people|person/i.test(lowerMsg);

        if (allNumbers && seatKeywords) {
            const requestedSeats = allNumbers; // Array of numbers e.g. ["5", "6"]
            const fuelInSeatQuery = lowerMsg.match(/\b(petrol|diesel|electric|cng|ev)\b/i);
            let requestedFuelInSeat = fuelInSeatQuery ? fuelInSeatQuery[1].toLowerCase() : null;
            if (requestedFuelInSeat === "ev") requestedFuelInSeat = "electric";

            const allCars = await Car.find({}).lean();
            let matchedCars = allCars.filter(c => {
                const seating = (c.seatingCapacity || "").toLowerCase();
                // Check if any of the requested numbers are in the car's seating capacity string
                return requestedSeats.some(num => seating.includes(num));
            });

            // Apply fuel filter too if mentioned
            if (requestedFuelInSeat) {
                matchedCars = matchedCars.filter(c => {
                    const fuel = (c.fuelType || "").toLowerCase();
                    return fuel.includes(requestedFuelInSeat);
                });
            }

            let filterReply;
            const filterLabel = requestedSeats.join("-") + "-seater";

            if (matchedCars.length === 0) {
                if (type === "audio") {
                    filterReply = `Maaf kijiye, ${filterLabel} mein currently koi Mahindra car available nahi hai. 🚗`;
                } else {
                    filterReply = session.data.detectedLanguage === "GUJARATI"
                        ? `Maaf karjo, ${filterLabel} car ma hal koi option nathi. 🚗`
                        : `Maaf kijiye, ${filterLabel} mein currently koi Mahindra car available nahi hai. 🚗`;
                }
            } else {
                // Save list to session for number selection
                session.data.lastShownList = matchedCars.map(c => c.name);
                session.markModified('data');
                await session.save();

                const listContent = matchedCars.map((c, i) => `${i + 1}. ${c.name} (${c.seatingCapacity}, ${c.fuelType})`).join("\n");

                if (type === "audio") {
                    filterReply = `${filterLabel} Mahindra cars:\n\n${listContent}\n\nKisi car ke baare mein detail chahiye toh number ya naam batayein. 🚗`;
                } else {
                    filterReply = session.data.detectedLanguage === "GUJARATI"
                        ? `${filterLabel} Mahindra Caroni list:\n\n${listContent}\n\nKayi gaadi vishe janva mango cho?`
                        : `${filterLabel} Mahindra cars:\n\n${listContent}\n\nKisi car ke baare mein detail chahiye toh number ya naam batayein. 🚗`;
                }
            }

            await sendMessage(sender, filterReply);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: filterReply, content: filterReply }).save();
            return res.status(200).send("OK");
        }

        // 3B. FUEL TYPE FILTER BYPASS (Hardcoded - no AI dependency)
        const fuelMatch = lowerMsg.match(/\b(petrol|diesel|electric|cng|ev)\b/i);
        const isFuelQuery = fuelMatch && /\b(car|cars|gaadi|gadiyan|wali|wala|batao|dikhao|available|mein|me|konsi|kaunsi|list|search|dekhni|puchni|looking|see|view)\b/i.test(lowerMsg);
        if (isFuelQuery) {
            let requestedFuel = fuelMatch[1].toLowerCase();
            if (requestedFuel === "ev") requestedFuel = "electric";

            const allCars = await Car.find({}).lean();
            const matchedCars = allCars.filter(c => {
                const fuel = (c.fuelType || "").toLowerCase();
                return fuel.includes(requestedFuel);
            });

            let filterReply;
            if (matchedCars.length === 0) {
                if (type === "audio") {
                    filterReply = `Maaf kijiye, ${requestedFuel} mein currently koi car available nahi hai. 🚗`;
                } else {
                    filterReply = session.data.detectedLanguage === "GUJARATI"
                        ? `Maaf karjo, ${requestedFuel} ma hal koi car available nathi.`
                        : `Maaf kijiye, ${requestedFuel} mein currently koi car available nahi hai. 🚗`;
                }
            } else {
                // Save list to session for number selection
                session.data.lastShownList = matchedCars.map(c => c.name);
                await session.save();

                const listContent = matchedCars.map((c, i) => `${i + 1}. ${c.name} (${c.fuelType})`).join("\n");

                if (type === "audio") {
                    filterReply = `${requestedFuel.toUpperCase()} Mahindra cars:\n\n${listContent}\n\nKisi car ke baare mein detail chahiye toh number ya naam batayein. 🚗`;
                } else {
                    filterReply = session.data.detectedLanguage === "GUJARATI"
                        ? `${requestedFuel.toUpperCase()} Mahindra Caroni list:\n\n${listContent}\n\nKayi gaadi vishe janva mango cho?`
                        : `${requestedFuel.toUpperCase()} Mahindra cars:\n\n${listContent}\n\nKisi car ke baare mein detail chahiye toh number ya naam batayein. 🚗`;
                }
            }

            await sendMessage(sender, filterReply);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: filterReply, content: filterReply }).save();
            return res.status(200).send("OK");
        }

        // 3C. NUMBER SELECTION BYPASS (When user selects from a previously shown list)
        const numberWords = { "one": 1, "ek": 1, "pehla": 1, "pahla": 1, "first": 1, "two": 2, "do": 2, "doosra": 2, "dusra": 2, "second": 2, "three": 3, "teen": 3, "teesra": 3, "third": 3, "four": 4, "char": 4, "chautha": 4, "fourth": 4, "five": 5, "paanch": 5, "fifth": 5, "six": 6, "chhe": 6, "sixth": 6, "seven": 7, "saat": 7, "seventh": 7, "eight": 8, "aath": 8, "eighth": 8 };

        let selectedNumber = null;
        if (numericMatch) {
            selectedNumber = parseInt(numericMatch[1]);
        }
        // Also check for word-based numbers
        for (const [word, num] of Object.entries(numberWords)) {
            if (lowerMsg.includes(word)) {
                selectedNumber = selectedNumber || num;
                break;
            }
        }

        if (selectedNumber && selectedNumber >= 1 && selectedNumber <= 8 && lowerMsg.length < 15 && session.data.lastShownList && session.data.lastShownList.length > 0) {
            const lastList = session.data.lastShownList;
            if (selectedNumber <= lastList.length) {
                const selectedCarName = lastList[selectedNumber - 1];
                const selectedCar = await Car.findOne({ name: selectedCarName }).lean();

                if (selectedCar) {
                    session.data.carModel = selectedCar.name;
                    session.markModified('data');
                    await session.save();

                    const detailCard = `Mahindra ${selectedCar.name} 🚗\n\n💰 Price: ${selectedCar.price}\n🎨 Colors: ${selectedCar.colors ? selectedCar.colors.slice(0, 3).join(", ") : "Premium Colors"}\n⛽ Fuel Type: ${selectedCar.fuelType}\n📊 Mileage: ${selectedCar.mileage}`;

                    await sendMessage(sender, detailCard);
                    await new Chat({ sender, role: "user", content: textRaw }).save();
                    await new Chat({ sender, role: "assistant", reply: detailCard, content: detailCard }).save();
                    return res.status(200).send("OK");
                }
            } else {
                const errMsg = `Kripaya 1 se ${lastList.length} ke beech mein number chunein. 🚗`;
                await sendMessage(sender, errMsg);
                await new Chat({ sender, role: "user", content: textRaw }).save();
                await new Chat({ sender, role: "assistant", reply: errMsg, content: errMsg }).save();
                return res.status(200).send("OK");
            }
        }

        if (isGeneralCarListQuery && lowerMsg.split(/\s+/).length < 10) {
            const cars = await Car.find({}).lean();

            // Save list to session for number selection
            session.data.lastShownList = cars.map(c => c.name);
            session.markModified('data');
            await session.save();

            const carListText = cars.map((c, i) => `${i + 1}. ${c.name}`).join("\n");

            await sendMessage(sender, carListText);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: carListText, content: carListText }).save();
            return res.status(200).send("OK");
        }

        const carsList = await Car.find({});
        let detectedCar = null;
        const normalizedMsg = lowerMsg.replace(/[-\s]+/g, " ");

        for (const car of carsList) {
            const fullName = car.name.toLowerCase();
            const shortName = fullName.replace(/mahindra\s+/i, "").trim();
            const normalizedShortName = shortName.replace(/[-\s]+/g, " ");
            const noSpaceName = normalizedShortName.replace(/\s+/g, "");

            if (normalizedMsg.includes(normalizedShortName) || normalizedMsg.replace(/\s+/g, "").includes(noSpaceName)) {
                detectedCar = car.name;
                break;
            }
        }

        if (detectedCar) {
            session.data.carModel = detectedCar;
            await session.save();
        }

        const isBookingAction = /\b(book this|book it|book now|confirmed book|proceed to book|book kare|booking|book karna hai|book car|booking karwani hai|book karo|book karna|book krna|book krr do)\b/i.test(lowerMsg);
        const isBookingInfo = /\b(how to book|process|book kaise kare)\b/i.test(lowerMsg);
        const isDetailQuery = /detail|show|info|specs|price|mileage|image|photo|pic/i.test(lowerMsg);

        // 3C. NO IMAGES BYPASS (Hardcoded)
        if (isImageRequest) {
            const noImgMsg = session.data.detectedLanguage === "GUJARATI"
                ? `માફ કરજો, મારી પાસે હાલ ફોટા કે ઈમેજ ઉપલબ્ધ નથી. પણ હું તમને ગાડીના ફીચર્સ, પ્રાઈસ અને સ્પેક્સ વિશે જણાવી શકું છું. 🚗`
                : `Maaf kijiye, mere paas abhi photos ya images available nahi hain. Lekin main aapko Mahindra cars ke features, price aur specifications ke baare mein detailed jankari de sakta hoon. 🚗`;

            await sendMessage(sender, noImgMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: noImgMsg, content: noImgMsg }).save();
            return res.status(200).send("OK");
        }

        // 4. BOOKING BYPASS (REFINED - FORCE CAR SELECTION FIRST)
        if (isBookingAction && !detectedCar && !session.data.carModel) {
            const cars = await Car.find({}).lean();
            session.data.lastShownList = cars.map(c => c.name);
            session.markModified('data');
            await session.save();

            const noCarMsg = session.data.detectedLanguage === "GUJARATI"
                ? `બુકિંગ માટે પહેલા ગાડી પસંદ કરો. અમારી ગાડીઓની લિસ્ટ:\n\n` + cars.map((c, i) => `${i + 1}. ${c.name}`).join("\n") + `\n\nકઈ ગાડી બુક કરવી છે? 🚗`
                : `Booking ke liye pehle car select karein. Humari Mahindra list:\n\n` + cars.map((c, i) => `${i + 1}. ${c.name}`).join("\n") + `\n\nKripaya list se car select karein ya number batayein. 🚗`;

            await sendMessage(sender, noCarMsg);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: noCarMsg, content: noCarMsg }).save();
            return res.status(200).send("OK");
        }

        if (isBookingAction && (detectedCar || session.data.carModel)) {
            const carName = detectedCar || session.data.carModel;
            const bookingSummary = `Your selection of Mahindra ${carName} is confirmed! 🚙 Please share your 6-digit Pincode to continue.`;

            session.state = "PINCODE";
            await session.save();

            await sendMessage(sender, bookingSummary);
            await new Chat({ sender, role: "user", content: textRaw }).save();
            await new Chat({ sender, role: "assistant", reply: bookingSummary, content: bookingSummary }).save();
            return res.status(200).send("OK");
        }

        // 5. DETAIL BYPASS (REMOVED AS PER USER REQUEST - ALWAYS USE AI)
        /*
        const isExplicitDetail = /detail|show|info|specs|price|mileage|image|photo|pic|batao|kya hai/i.test(lowerMsg);
        if (detectedCar && (isExplicitDetail || lowerMsg.length < 15)) {
            // ... (Bypass disabled)
        }
        */


        const historyContext = (await Chat.find({ sender }).sort({ timestamp: -1 }).limit(3)).reverse()
            .map(c => `${c.role === 'user' ? 'User' : 'Advisor'}: ${c.reply || c.content}`).join("\n");

        const aiFinal = await getAIResponse(textRaw || "Hi", historyContext, `${req.protocol}://${req.get('host')}`, session, type);
        await sendMessage(sender, aiFinal);

        await new Chat({ sender, role: "user", content: textRaw }).save();
        await new Chat({ sender, role: "assistant", reply: aiFinal, content: aiFinal }).save();

        return res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Fatal Webhook Error:", error.message);
        return res.status(200).send("OK");
    }
}

export function verifyWebhook(req, res) {
    if (req.query["hub.mode"] && req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
        return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(403).send("Forbidden");
}