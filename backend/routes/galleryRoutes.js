import express from "express";
import Car from "../models/Car.js";

const router = express.Router();

router.get("/:carName", async (req, res) => {
    try {
        const car = await Car.findOne({ name: new RegExp(req.params.carName, "i") });
        if (!car) return res.status(404).send("Car not found");

        const imagesHtml = car.images.map(img => `
            <div class="card">
                <img src="${img}" alt="${car.name}">
            </div>
        `).join("");

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
    <a href="https://wa.me/${process.env.ZA_WA_NUMBER || '911234567890'}" class="btn">Back to Chat</a>
</body>
</html>
        `;
        res.send(html);
    } catch (err) {
        res.status(500).send("Error loading gallery");
    }
});

export default router;
