import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";
import dns from "dns";

dns.setServers(['8.8.8.8', '1.1.1.1']);


dotenv.config({ path: "./.env" });

const cars = [
    {
        name: "Mahindra Thar",
        price: "11.35 - 17.60 Lakh",
        type: "SUV",
        mileage: "15.2 kmpl",
        features: ["4x4 Capability", "Touchscreen Infotainment", "Soft/Hard Top"],
        description: "The ultimate off-road icon."
    },
    {
        name: "Mahindra XUV700",
        price: "13.99 - 26.99 Lakh",
        type: "SUV",
        mileage: "16.5 kmpl",
        features: ["ADAS Level 2", "Panoramic Sunroof", "360 Camera"],
        description: "Sophistication meets performance."
    },
    {
        name: "Mahindra Scorpio-N",
        price: "13.85 - 24.54 Lakh",
        type: "SUV",
        mileage: "14.4 kmpl",
        features: ["Rugged Design", "Sony 3D Sound", "Sunroof"],
        description: "The Big Daddy of SUVs."
    },
    {
        name: "Mahindra XUV 3XO",
        price: "7.49 - 15.49 Lakh",
        type: "SUV",
        mileage: "18.89 - 21.2 kmpl",
        features: ["Skyroof", "Level 2 ADAS", "Dual-zone Climate"],
        description: "Everything you want and more."
    },
    {
        name: "Mahindra Bolero Neo",
        price: "9.90 - 12.15 Lakh",
        type: "SUV",
        mileage: "17.2 kmpl",
        features: ["7-seater", "Touchscreen", "Micro Hybrid Tech"],
        description: "Modern avatar of the legend."
    },
    {
        name: "Mahindra Bolero",
        price: "9.90 - 10.91 Lakh",
        type: "SUV",
        mileage: "16.0 kmpl",
        features: ["Rugged Build", "Spacious 7-seater", "Reliable Tech"],
        description: "The legendary workhorse."
    },
    {
        name: "Mahindra XUV400 EV",
        price: "15.49 - 19.39 Lakh",
        type: "Electric SUV",
        mileage: "375-456 km range",
        features: ["Fast Charging", "High Performance", "Eco Friendly"],
        description: "The first all-electric Mahindra SUV."
    },
    {
        name: "Mahindra Marazzo",
        price: "14.39 - 16.80 Lakh",
        type: "MPV",
        mileage: "17.3 kmpl",
        features: ["Shark-inspired Design", "Spacious Cabin", "Rear AC Vents"],
        description: "Comfortable family MPV."
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
