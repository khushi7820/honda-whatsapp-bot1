import { connectDB } from './config/db.js';
import Car from './models/Car.js';
import dotenv from 'dotenv';

dotenv.config();

const updates = {
    'Mahindra Thar': [
        'https://park-public.s3.ap-south-1.amazonaws.com/offering/offering_images/411/original/Mahindra_Thar.jpg'
    ],
    'Mahindra XUV700': [
        'https://park-public.s3.ap-south-1.amazonaws.com/offering/offering_images/413/original/Mahindra_XUV700.jpg'
    ],
    'Mahindra Scorpio-N': [
        'https://park-public.s3.ap-south-1.amazonaws.com/offering/offering_images/409/original/Mahindra_Scorpio-N.jpg'
    ],
    'Mahindra XUV 3XO': [
        'https://imgd.aeplcdn.com/664x374/n/cw/ec/151747/xuv-3xo-exterior-front-view.jpeg'
    ],
    'Mahindra Bolero Neo': [
        'https://stimg.cardekho.com/images/carexteriorimages/630x420/Mahindra/Bolero-Neo/8499/1626154620027/front-left-side-47.jpg'
    ],
    'Mahindra Bolero': [
        'https://stimg.cardekho.com/images/carexteriorimages/630x420/Mahindra/Bolero/10769/1693895318182/front-left-side-47.jpg'
    ],
    'Mahindra XUV400 EV': [
        'https://stimg.cardekho.com/images/carexteriorimages/630x420/Mahindra/XUV400-EV/9253/1662635467664/front-left-side-47.jpg'
    ],
    'Mahindra Marazzo': [
        'https://stimg.cardekho.com/images/carexteriorimages/630x420/Mahindra/Marazzo/6475/1572322524451/front-left-side-47.jpg'
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
