import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";

import dns from "dns";
dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const cars = await Car.find({});
        console.log("Cars in DB:");
        cars.forEach(c => console.log(`- ${c.name}`));
        console.log(`Total: ${cars.length}`);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkDB();
