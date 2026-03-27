import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";
import dns from "dns";

dns.setServers(['8.8.8.8', '1.1.1.1']);


dotenv.config({ path: "../.env" });

const cars = [
    {
        name: "Mahindra Thar",
        price: "11.35 - 17.60 Lakh",
        type: "SUV",
        mileage: "15.2 kmpl",
        features: ["4x4 Capability", "Touchscreen Infotainment", "Soft/Hard Top options", "LED DRLs"],
        description: "The ultimate off-road icon. Built for those who explore the impossible."
    },
    {
        name: "Mahindra XUV700",
        price: "13.99 - 26.99 Lakh",
        type: "SUV",
        mileage: "16.5 kmpl",
        features: ["ADAS Level 2", "Dual 10.25-inch Screens", "Panoramic Sunroof", "360-degree Camera"],
        description: "Sophistication meets performance. The most advanced SUV in its segment."
    },
    {
        name: "Mahindra Scorpio-N",
        price: "13.85 - 24.54 Lakh",
        type: "SUV",
        mileage: "14.4 kmpl",
        features: ["Rugged Design", "Sunroof", "Sony 3D Sound System", "Brave Heart Engine"],
        description: "The Big Daddy of SUVs. Unmatched power and presence on any road."
    },
    {
        name: "Mahindra XUV 3XO",
        price: "7.49 - 15.49 Lakh",
        type: "SUV",
        mileage: "18.89 - 21.2 kmpl",
        features: ["Skyroof", "Level 2 ADAS", "Dual-zone Climate Control", "Electronic Parking Brake"],
        description: "Everything you want and more. A compact SUV with big features."
    },
    {
        name: "Mahindra Bolero Neo",
        price: "9.90 - 12.15 Lakh",
        type: "SUV",
        mileage: "17.2 kmpl",
        features: ["7-seater", "Touchscreen Display", "Static Bending Headlamps", "Micro Hybrid Tech"],
        description: "The modern avatar of the legendary Bolero. Tough as nails, comfortable inside."
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await Car.deleteMany({});
        await Car.insertMany(cars);
        console.log("Database seeded successfully with Mahindra cars! 🚗");
        process.exit();
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};

seedDB();
