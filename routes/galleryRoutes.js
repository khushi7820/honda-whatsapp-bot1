import express from "express";
import Car from "../models/Car.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

// 🏰 VIRTUAL SHOWROOM - Catalog Page
router.get("/", async (req, res) => {
    try {
        await connectDB();
        const cars = await Car.find({});
        
        const catalogCards = cars.map(car => {
            const img = (car.images && car.images.length > 0) ? car.images[0] : (car.imageUrl || "");
            const proxiedUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(img)}`;
            
            return `
            <a href="/gallery/${car.name.toLowerCase().replace(/\s+/g, '-')}" class="card-link">
                <div class="card">
                    <div class="img-container">
                        <img src="${proxiedUrl}" alt="${car.name}" referrerpolicy="no-referrer">
                    </div>
                    <div class="card-info">
                        <h3>${car.name}</h3>
                        <p>${car.type} • ${car.price}</p>
                    </div>
                </div>
            </a>
            `;
        }).join("");

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mahindra Virtual Showroom</title>
    <style>
        body { font-family: 'Outfit', sans-serif; background: #0b0b0b; color: white; margin: 0; padding: 40px 20px; }
        h1 { text-align: center; color: #ed1c24; text-transform: uppercase; letter-spacing: 4px; font-size: 2.5rem; margin-bottom: 40px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto; }
        .card-link { text-decoration: none; color: inherit; transition: transform 0.3s ease; }
        .card-link:hover { transform: translateY(-10px); }
        .card { background: #1a1a1a; border-radius: 20px; overflow: hidden; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .img-container { width: 100%; height: 230px; overflow: hidden; background: #000; }
        img { width: 100%; height: 100%; object-fit: cover; border-bottom: 3px solid #ed1c24; }
        .card-info { padding: 20px; text-align: left; }
        h3 { margin: 0 0 5px 0; font-size: 1.4rem; color: #fff; }
        p { margin: 0; color: #888; font-size: 0.9rem; }
        .footer { text-align: center; margin-top: 50px; color: #444; font-size: 0.8rem; letter-spacing: 1px; }
    </style>
</head>
<body>
    <h1>Virtual Showroom</h1>
    <div class="grid">
        ${catalogCards}
    </div>
    <div class="footer">
        © 2026 MAHINDRA AI EXPERIENCE • PREMIUM DEALERSHIP PORTAL
    </div>
</body>
</html>
        `;
        res.send(html);
    } catch (err) {
        console.error("Catalog Error:", err);
        res.status(500).send("Unable to open showroom.");
    }
});

// 📸 INDIVIDUAL GALLERY PAGE
router.get("/:carName", async (req, res) => {
    try {
        await connectDB();
        const carNameParam = req.params.carName;
        if (carNameParam === "all") return res.redirect("/gallery");

        const searchRegex = carNameParam.replace(/-/g, "[\\s-]");
        const car = await Car.findOne({ name: { $regex: new RegExp(searchRegex, "i") } });

        if (!car) {
            return res.status(404).send(`Car "${carNameParam}" details coming soon!`);
        }

        const imagesHtml = car.images.map(img => {
            const proxiedUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(img)}`;
            return `<div class="card"><img src="${proxiedUrl}" alt="${car.name}" referrerpolicy="no-referrer"></div>`;
        }).join("");

        const mainImg = car.images?.[0] || car.imageUrl;
        const metaImg = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&url=${encodeURIComponent(mainImg)}`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- WhatsApp Preview Tags -->
    <meta property="og:title" content="Mahindra ${car.name} - Gallery">
    <meta property="og:description" content="${car.type} | ${car.price}">
    <meta property="og:image" content="${metaImg}">
    <meta property="og:type" content="website">

    <title>${car.name} Gallery | Mahindra</title>
    <style>
        body { font-family: 'Outfit', sans-serif; background: #0b0b0b; color: white; margin: 0; padding: 0; text-align: center; }
        .header { background: linear-gradient(180deg, #1a1a1a 0%, #0b0b0b 100%); padding: 50px 20px; border-bottom: 1px solid #333; }
        h1 { margin: 0; color: #ed1c24; text-transform: uppercase; letter-spacing: 3px; font-size: 2.2rem; }
        .specs { color: #888; font-size: 1.1rem; margin-top: 10px; }
        .gallery { display: flex; flex-direction: column; gap: 30px; align-items: center; padding: 40px 20px; }
        .card { width: 100%; max-width: 800px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); background: #1a1a1a; border: 1px solid #222; }
        img { width: 100%; height: auto; display: block; border-bottom: 4px solid #ed1c24; }
        .btn { display: inline-block; padding: 15px 40px; background: #ed1c24; color: white; text-decoration: none; border-radius: 50px; margin: 40px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; transition: all 0.3s ease; }
        .btn:hover { background: #b11116; transform: scale(1.05); }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mahindra ${car.name}</h1>
        <div class="specs">${car.type}  •  ${car.price}  •  ${car.fuelType}</div>
    </div>
    <div class="gallery">
        ${imagesHtml}
    </div>
    <a href="https://wa.me/15558689519" class="btn">Back to Advisor</a>
    <p style="color: #444; font-size: 0.8rem; margin-bottom: 40px;">*T&C Apply. Prices are ex-showroom.</p>
</body>
</html>
        `;
        res.send(html);
    } catch (err) {
        console.error("Gallery Error:", err);
        res.status(500).send("Error loading gallery");
    }
});

export default router;
