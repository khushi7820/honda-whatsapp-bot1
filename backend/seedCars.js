import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";
import dns from "dns";

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config({ path: "./.env" });

const cars = [
    {
        name: "Mahindra XUV700",
        price: "13.99 - 26.99 Lakh",
        type: "Premium SUV",
        seatingCapacity: "5/7-Seater",
        mileage: "13.0 - 17.0 kmpl",
        fuelType: "Petrol/Diesel",
        colors: ["Everest White", "Midnight Black", "Dazzling Silver", "Red Rage", "Electric Blue"],
        features: ["ADAS L2", "Dual HD Screens", "Smart Door Handles", "Skyroof"],
        description: "The most premium Mahindra SUV.",
        imageUrl: "https://imgd.aeplcdn.com/664x374/n/cw/ec/42355/xuv700-exterior-right-front-three-quarter-3.jpeg"
    },
    {
        name: "Mahindra Scorpio-N",
        price: "13.60 - 24.54 Lakh",
        type: "Powerful SUV",
        seatingCapacity: "6/7-Seater",
        mileage: "12.0 - 16.0 kmpl",
        fuelType: "Petrol/Diesel",
        colors: ["Deep Forest", "Everest White", "Napoli Black", "Dazzling Silver", "Red Rage"],
        features: ["4X4 Explorer Mode", "Sony 3D Sound", "Adrenox Connect", "Sunroof"],
        description: "The Big Daddy of SUVs.",
        imageUrl: "https://imgd.aeplcdn.com/664x374/n/cw/ec/40432/scorpio-n-exterior-right-front-three-quarter-75.jpeg"
    },
    {
        name: "Mahindra Thar",
        price: "11.25 - 17.60 Lakh",
        type: "Off-Road SUV",
        seatingCapacity: "4-Seater",
        mileage: "8.0 - 15.0 kmpl",
        fuelType: "Petrol/Diesel",
        colors: ["Napoli Black", "Red Rage", "Galaxy Grey", "Deep Forest", "Everest White"],
        features: ["4WD System", "Touchscreen", "Adventure Statistics", "Washable Interior"],
        description: "The iconic off-roader.",
        imageUrl: "https://imgd.aeplcdn.com/664x374/n/cw/ec/40087/thar-exterior-right-front-three-quarter-35.jpeg"
    },
    {
        name: "Mahindra XUV 3XO",
        price: "7.49 - 15.49 Lakh",
        type: "Compact SUV",
        seatingCapacity: "5-Seater",
        mileage: "18.0 - 20.0 kmpl",
        fuelType: "Petrol/Diesel",
        colors: ["Citrine Yellow", "Dune Beige", "Everest White", "Napoli Black"],
        features: ["Skyroof", "Level 2 ADAS", "Electronic Parking Brake"],
        description: "The thrill-driven compact SUV.",
        imageUrl: "https://imgd.aeplcdn.com/664x374/n/cw/ec/131151/bolero-neo-exterior-right-front-three-quarter.jpeg"
    },
    {
        name: "Mahindra Bolero",
        price: "9.90 - 10.91 Lakh",
        type: "Rugged SUV",
        seatingCapacity: "7-Seater",
        mileage: "16.0 kmpl",
        fuelType: "Diesel",
        colors: ["Diamond White", "Lakeside Brown", "Dsat Silver"],
        features: ["Strong Metal Body", "Micro Hybrid Tech", "Digital Cluster"],
        description: "The dependable workhorse.",
        imageUrl: "https://imgd.aeplcdn.com/664x374/n/cw/ec/131179/bolero-exterior-right-front-three-quarter.jpeg"
    },
    {
        name: "Mahindra Bolero Neo",
        price: "9.90 - 12.15 Lakh",
        type: "Modern Rugged SUV",
        seatingCapacity: "7-Seater",
        mileage: "17.29 kmpl",
        fuelType: "Diesel",
        colors: ["Rocky Beige", "Napoli Black", "Majestic Silver", "Pearl White"],
        features: ["Multi Terrain Tech", "Premium Interior", "Touchscreen"],
        description: "The modern Bolero.",
        imageUrl: "https://imgd.aeplcdn.com/664x374/n/cw/ec/131151/bolero-neo-exterior-right-front-three-quarter.jpeg"
    },
    {
        name: "Mahindra XUV400 EV",
        price: "15.49 - 19.39 Lakh",
        type: "Electric SUV",
        seatingCapacity: "5-Seater",
        mileage: "375 - 456 km/charge",
        fuelType: "Electric",
        colors: ["Arctic Blue", "Napoli Black", "Everest White", "Infinity Blue"],
        features: ["Fast Charging", "Copper Accents", "0-60 in 8.3s"],
        description: "The electric SUV with a pulse.",
        imageUrl: "https://img.etimg.com/thumb/width-420,height-315,imgsize-21980,resizemode-75,msid-106726760/industry/renewables/mahindra-xuv-400-pro-launched-here-are-price-details-all-the-added-features/mahindra-xuv400.jpg"
    },
    {
        name: "Mahindra Marazzo",
        price: "14.39 - 16.80 Lakh",
        type: "MPV",
        seatingCapacity: "7/8-Seater",
        mileage: "17.3 kmpl",
        fuelType: "Diesel",
        colors: ["Iceberg White", "Oceanic Silver", "Aqua Marine"],
        features: ["Quiet Cabin", "Surround Cool AC", "Best in class ride quality"],
        description: "The shark-inspired premium MPV.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/Mahindra_Marazzo_MPV_SEP_18_%283%29.jpg"
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
