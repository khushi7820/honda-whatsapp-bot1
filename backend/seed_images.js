import { connectDB } from './config/db.js';
import Car from './models/Car.js';
import dotenv from 'dotenv';

dotenv.config();

const updates = {
    'Mahindra Thar': [
        'https://stimg.cardekho.com/images/carexteriorimages/930x620/Mahindra/Thar/8068/1601633534963/front-left-side-47.jpg',
        'https://images.livemint.com/img/2021/08/15/600x338/Mahindra_Thar_1629007328906_1629007335198.jpg'
    ],
    'Mahindra XUV700': [
        'https://stimg.cardekho.com/images/carexteriorimages/930x620/Mahindra/XUV700/8604/1630043640201/front-left-side-47.jpg',
        'https://images.livemint.com/img/2021/08/15/600x338/Mahindra_XUV700_1629007328906_1629007335198.jpg'
    ],
    'Mahindra Scorpio-N': [
        'https://stimg.cardekho.com/images/carexteriorimages/930x620/Mahindra/Scorpio-N/9060/1656330663445/front-left-side-47.jpg'
    ],
    'Mahindra XUV 3XO': [
        'https://stimg.cardekho.com/images/carexteriorimages/930x620/Mahindra/XUV-3XO/11558/1714378121287/front-left-side-47.jpg'
    ],
    'Mahindra Bolero Neo': [
        'https://stimg.cardekho.com/images/carexteriorimages/930x620/Mahindra/Bolero-Neo/8499/1626154620027/front-left-side-47.jpg'
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
