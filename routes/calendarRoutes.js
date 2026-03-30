import express from "express";
import Car from "../models/Car.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

// Calendar View
router.get("/calendar", async (req, res) => {
    const { carId } = req.query;
    const carName = carId ? carId.replace(/-/g, " ") : "Mahindra SUV";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Book Your Mahindra Test Drive</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #e31837;
            --dark: #1a1a1a;
            --glass: rgba(255, 255, 255, 0.1);
        }
        body {
            font-family: 'Outfit', sans-serif;
            background: var(--dark);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            overflow-x: hidden;
        }
        .container {
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        h1 { color: var(--primary); margin-bottom: 5px; }
        p { color: #ccc; font-size: 0.9rem; margin-bottom: 25px; }
        
        input[type="date"] {
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--primary);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-size: 1.1rem;
            width: 100%;
            box-sizing: border-box;
            outline: none;
            margin-bottom: 20px;
        }
        
        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            width: 100%;
            transition: all 0.3s;
        }
        .btn:hover { transform: scale(1.02); box-shadow: 0 5px 15px rgba(227, 24, 55, 0.4); }
        
        .disclaimer { font-size: 0.7rem; color: #777; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Mahindra</h1>
        <p>Select a date for your <b>${carName}</b> test drive</p>
        
        <input type="date" id="testDriveDate" min="${new Date().toISOString().split('T')[0]}">
        
        <button class="btn" onclick="confirmDate()">Confirm Date</button>
        
        <div class="disclaimer">You will be redirected back to WhatsApp to finish booking.</div>
    </div>

    <script>
        function confirmDate() {
            const date = document.getElementById('testDriveDate').value;
            if (!date) {
                alert("Please select a date first! 😊");
                return;
            }
            
            // Format date for msg
            const d = new Date(date);
            const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            
            const whatsappNumber = "15558689519"; 
            const message = encodeURIComponent("I choose " + formatted + " for my test drive.");
            window.location.href = "https://wa.me/" + whatsappNumber + "?text=" + message;
        }
    </script>
</body>
</html>
        `;
    res.send(html);
});

export default router;
