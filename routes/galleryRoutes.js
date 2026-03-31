import express from "express";
import Car from "../models/Car.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

router.get("/:carName", async (req, res) => {
    try {
        await connectDB();
        if (!req.params.carName) return res.redirect("/");

        // Replace hyphens with dots to match spaces or hyphens in DB
        const searchRegex = req.params.carName.replace(/-/g, ".");
        console.log(`[Gallery] Searching with regex: "${searchRegex}"`);
        
        const car = await Car.findOne({ name: { $regex: new RegExp(searchRegex, "i") } });
        if (!car) {
            console.error(`[Gallery] Car Not Found: ${req.params.carName}`);
            return res.status(404).send(`Car details for "${req.params.carName}" are currently being updated. Please check back soon!`);
        }

        const imagesHtml = car.images.map(img => {
            // Use Google's Image Proxy to bypass CORS/Referrer issues
            const proxiedUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(img)}`;
            return `
            <div class="card">
                <img src="${proxiedUrl}" alt="${car.name}" referrerpolicy="no-referrer">
            </div>
            `;
        }).join("");

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${car.name} Gallery</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #111; color: white; margin: 0; padding: 20px; text-align: center; }
        .gallery { display: flex; flex-direction: column; gap: 20px; align-items: center; padding: 20px; }
        .card { width: 100%; max-width: 600px; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); background: #222; }
        img { width: 100%; height: auto; display: block; border-bottom: 2px solid #ed1c24; }
        h1 { margin-bottom: 5px; color: #ed1c24; text-transform: uppercase; letter-spacing: 2px; }
        p { color: #888; margin-top: 0; }
        .btn { display: inline-block; padding: 12px 24px; background: #ed1c24; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
    </style>
</head>
<body>
    <h1>${car.name}</h1>
    <p>${car.type} | ${car.price}</p>
    <div class="gallery">
        ${imagesHtml}
    </div>
    <p style="font-size: 0.8rem; color: #555; margin-top: 20px;">*Note: Prices are ex-showroom and subject to change.*</p>
    <a href="https://wa.me/15558689519" class="btn">Back to Chat</a>
</body>
</html>
        `;
        res.send(html);
    } catch (err) {
        res.status(500).send("Error loading gallery");
    }
});

export default router;
