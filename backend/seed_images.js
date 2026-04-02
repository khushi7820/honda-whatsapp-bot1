import mongoose from "mongoose";
import dotenv from "dotenv";
import Car from "./models/Car.js";
import dns from "dns";

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: "./.env" });

const updates = {
    'Mahindra Thar': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/40087/thar-exterior-right-front-three-quarter-35.jpeg' 
    ],
    'Mahindra XUV700': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/42355/xuv700-exterior-right-front-three-quarter-3.jpeg' 
    ],
    'Mahindra Scorpio-N': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/40432/scorpio-n-exterior-right-front-three-quarter-75.jpeg' 
    ],
    'Mahindra XUV 3XO': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/131111/xuv-3xo-exterior-right-front-three-quarter.jpeg'
    ],
    'Mahindra Bolero Neo': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/131151/bolero-neo-exterior-right-front-three-quarter.jpeg' 
    ],
    'Mahindra Bolero': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/131179/bolero-exterior-right-front-three-quarter.jpeg' 
    ],
    'Mahindra XUV400 EV': [
        'https://img.etimg.com/thumb/width-420,height-315,imgsize-21980,resizemode-75,msid-106726760/industry/renewables/mahindra-xuv-400-pro-launched-here-are-price-details-all-the-added-features/mahindra-xuv400.jpg' 
    ],
    'Mahindra Marazzo': [
        'https://upload.wikimedia.org/wikipedia/commons/5/50/Mahindra_Marazzo_MPV_SEP_18_%283%29.jpg' 
    ]
};

async function seedImages() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected (Local)");

        for (const [name, imageUrls] of Object.entries(updates)) {
            console.log(`Updating ${name}...`);
            await Car.findOneAndUpdate(
                { name: { $regex: new RegExp(name, 'i') } },
                { images: imageUrls },
                { upsert: false }
            );
        }

        console.log("✅ Car Images Seeded!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding Error:", err.message);
        process.exit(1);
    }
}

seedImages();
