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
        fuelType: "Petrol & Diesel",
        colors: ["Rocky Beige", "Aquamarine", "Mystic Copper", "Red Rage", "Napoli Black", "Galaxy Grey"],
        features: ["4WD System", "Touchscreen Infotainment", "Adventure Stats Display"],
        description: "The legendary off-roader."
    },
    {
        name: "Mahindra XUV700",
        price: "13.99 - 26.99 Lakh",
        type: "SUV",
        mileage: "13.0 - 17.0 kmpl",
        fuelType: "Petrol & Diesel",
        colors: ["Everest White", "Midnight Black", "Dazzling Silver", "Red Rage", "Electric Blue"],
        features: ["ADAS Level 2", "Dual 10.25-inch Screens", "Sony 12-Speaker Sound System"],
        description: "The premium technology-packed SUV."
    },
    {
        name: "Mahindra Scorpio-N",
        price: "13.85 - 24.54 Lakh",
        type: "SUV",
        mileage: "14.0 - 15.0 kmpl",
        fuelType: "Petrol & Diesel",
        colors: ["Deep Forest", "Napoli Black", "Everest White", "Dazzling Silver", "Red Rage", "Grand Canyon"],
        features: ["4XPLOR Terrain Management", "AdrenoX Connected Car", "Powerful mHawk Engine"],
        description: "The Big Daddy of SUVs."
    },
    {
        name: "Mahindra XUV 3XO",
        price: "7.49 - 15.49 Lakh",
        type: "SUV",
        mileage: "18.8 - 20.1 kmpl",
        fuelType: "Petrol & Diesel",
        colors: ["Citrine Yellow", "Dune Beige", "Everest White", "Stealth Black", "Nebula Blue"],
        features: ["Largest Sunroof in Segment", "Level 2 ADAS", "Dual-Zone Climate Control"],
        description: "The standard-setting compact SUV."
    },
    {
        name: "Mahindra Bolero Neo",
        price: "9.90 - 12.15 Lakh",
        type: "SUV",
        mileage: "17.29 kmpl",
        fuelType: "Diesel",
        colors: ["Rocky Beige", "Highway Red", "Pearl White", "Napoli Black", "Majestic Silver"],
        features: ["Multi-Terrain Technology", "Rugged Body-on-Frame", "Reverse Assist"],
        description: "The modern take on the rugged Bolero."
    },
    {
        name: "Mahindra Bolero",
        price: "9.90 - 10.91 Lakh",
        type: "SUV",
        mileage: "16.0 kmpl",
        fuelType: "Diesel",
        colors: ["Lakeside Brown", "Mist Silver", "Diamond White"],
        features: ["Spacious 7-Seater", "Powerful mHawk75 Engine", "Legendary Durability"],
        description: "The trustworthy workhorse."
    },
    {
        name: "Mahindra XUV400 EV",
        price: "15.49 - 19.39 Lakh",
        type: "Electric",
        mileage: "375 - 456 km (Range)",
        fuelType: "Electric",
        colors: ["Arctic Blue", "Everest White", "Galaxy Grey", "Infinity Blue", "Napoli Black"],
        features: ["Fast Charging", "0-100 in 8.3s", "Highest Real-World Range"],
        description: "Mahindra's first all-electric SUV."
    },
    {
        name: "Mahindra Marazzo",
        price: "14.39 - 16.80 Lakh",
        type: "MPV",
        mileage: "17.3 kmpl",
        fuelType: "Diesel",
        colors: ["Iceberg White", "Oceanic Silver", "Aqua Marine"],
        features: ["Shark-Inspired Design", "Surround Cool Technology", "Quiet Cabin"],
        description: "The smooth and comfortable family MPV."
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await Car.deleteMany({});
        await Car.insertMany(cars);
        console.log("Database seeded successfully with Mahindra cars! 🚗");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};

seedDB();
