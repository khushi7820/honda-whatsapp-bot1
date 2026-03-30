import { connectDB } from './config/db.js';
import Car from './models/Car.js';
import dotenv from 'dotenv';

dotenv.config();

// Updated with accurate colors based on user's selected photos (Black Thar, Green Scorpio-N, Red XUV300, etc.)
const updates = {
    'Mahindra Thar': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/40087/thar-exterior-right-front-three-quarter-35.jpeg' // Black
    ],
    'Mahindra XUV700': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/42355/xuv700-exterior-right-front-three-quarter-3.jpeg' // Midnight Black
    ],
    'Mahindra Scorpio-N': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/40432/scorpio-n-exterior-right-front-three-quarter-75.jpeg' // Deep Forest / Green
    ],
    'Mahindra XUV 3XO': [
        'https://upload.wikimedia.org/wikipedia/commons/c/c2/2019_Mahindra_XUV300_W8.jpg' // Red XUV300
    ],
    'Mahindra Bolero Neo': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/131151/bolero-neo-exterior-right-front-three-quarter.jpeg' // Silver
    ],
    'Mahindra Bolero': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/131179/bolero-exterior-right-front-three-quarter.jpeg' // Dsat Silver / Grey
    ],
    'Mahindra XUV400 EV': [
        'https://img.etimg.com/thumb/width-420,height-315,imgsize-21980,resizemode-75,msid-106726760/industry/renewables/mahindra-xuv-400-pro-launched-here-are-price-details-all-the-added-features/mahindra-xuv400.jpg' // Electric Blue & Copper
    ],
    'Mahindra Marazzo': [
        'https://upload.wikimedia.org/wikipedia/commons/5/50/Mahindra_Marazzo_MPV_SEP_18_%283%29.jpg' // Marazzo White
    ]
};

async function seed() {
    await connectDB();
    for (const [name, imgs] of Object.entries(updates)) {
        console.log(`Updating ${name}...`);
        await Car.updateOne({ name }, { $set: { images: imgs } });
    }
    console.log('✅ Car Images Seeded!');
    process.exit(0);
}

seed();
