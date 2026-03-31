import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";
import dns from "dns";

dns.setServers(['8.8.8.8', '1.1.1.1']);


dotenv.config({ path: "./.env" });

const cars = [
    {
        name: "Honda City",
        price: "11.82 - 16.35 Lakh",
        type: "Sedan",
        mileage: "17.8 - 27.1 kmpl",
        fuelType: "Petrol & Hybrid",
        colors: ["Obsidian Blue", "Radiant Red", "Platinum White", "Golden Brown"],
        features: ["ADAS Level 2", "Sunroof", "Touchscreen"],
        description: "The benchmark of sedans."
    },
    {
        name: "Honda Elevate",
        price: "11.69 - 16.51 Lakh",
        type: "SUV",
        mileage: "15.3 - 16.9 kmpl",
        fuelType: "Petrol",
        colors: ["Phoenix Orange", "Obsidian Blue", "Radiant Red", "Platinum White"],
        features: ["High Ground Clearance", "ADAS", "Spacious Interior"],
        description: "The bold new SUV."
    },
    {
        name: "Honda Amaze",
        price: "7.20 - 9.95 Lakh",
        type: "Sedan",
        mileage: "18.3 - 18.6 kmpl",
        fuelType: "Petrol",
        colors: ["Meteoroid Grey", "Radiant Red", "Platinum White", "Lunar Silver"],
        features: ["CVT Option", "Spacious Trunk", "Modern Design"],
        description: "The perfect family sedan."
    },
    {
        name: "Honda Civic",
        price: "17.94 - 22.35 Lakh",
        type: "Sedan",
        mileage: "16.5 - 26.8 kmpl",
        fuelType: "Petrol & Diesel",
        colors: ["Modern Steel", "Lunar Silver", "Radiant Red", "Platinum White"],
        features: ["Sporty Design", "Premium Interior", "Dynamic Performance"],
        description: "The iconic sporty sedan."
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await Car.deleteMany({});
        await Car.insertMany(cars);
        console.log("Database seeded successfully with Honda cars! 🚗");
        process.exit();
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};

seedDB();
