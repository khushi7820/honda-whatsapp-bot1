import { connectDB } from './config/db.js';
import Car from './models/Car.js';
import dotenv from 'dotenv';

dotenv.config();

const updates = {
    'Mahindra Thar': [
        'https://upload.wikimedia.org/wikipedia/commons/9/91/Mahindra_Thar_SUV_in_%22Red_Rage%22_color_at_Ashiana_Brahmanda%2C_East_Singbhum_India_%28Ank_Kumar%2C_Infosys_limited%29_01.jpg'
    ],
    'Mahindra XUV700': [
        'https://upload.wikimedia.org/wikipedia/commons/b/ba/2021_Mahindra_XUV700_2.2_AX7_%28India%29_front_view.png'
    ],
    'Mahindra Scorpio-N': [
        'https://upload.wikimedia.org/wikipedia/commons/b/b4/2024_Mahindra_Scorpio_Z8L_front.jpg'
    ],
    'Mahindra XUV 3XO': [
        'https://mahindra.co.za/wp-content/uploads/2024/09/CLIENT_XUV-3XO-149444_R3-Light@2x.png'
    ],
    'Mahindra Bolero Neo': [
        'https://static.toiimg.com/thumb/124519681.jpg?photoid=124519681&imgsize=23456&width=600&resizemode=4'
    ],
    'Mahindra Bolero': [
        'https://upload.wikimedia.org/wikipedia/commons/d/d7/Mahindra_Bolero_ZLX.jpg'
    ],
    'Mahindra XUV400 EV': [
        'https://img.etimg.com/thumb/width-420,height-315,imgsize-21980,resizemode-75,msid-106726760/industry/renewables/mahindra-xuv-400-pro-launched-here-are-price-details-all-the-added-features/mahindra-xuv400.jpg'
    ],
    'Mahindra Marazzo': [
        'https://upload.wikimedia.org/wikipedia/commons/5/50/Mahindra_Marazzo_MPV_SEP_18_%283%29.jpg'
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
