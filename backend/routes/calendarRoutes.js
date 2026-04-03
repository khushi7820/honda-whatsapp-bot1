import express from "express";
import Car from "../models/Car.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

// Premium Web Booking Calendar
router.get("/calendar", async (req, res) => {
    const { carId, phone } = req.query;
    const carName = carId ? carId.replace(/-/g, " ").toUpperCase() : "MAHINDRA SUV";

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
            --dark: #000;
            --gray: #1a1a1a;
            --text-muted: #aaa;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background: var(--dark);
            color: white;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .card {
            background: var(--gray);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 24px;
            width: 100%;
            max-width: 450px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            text-align: center;
        }
        .logo { width: 120px; margin-bottom: 15px; }
        h1 { font-size: 1.5rem; margin: 10px 0; color: #fff; }
        p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 25px; }
        
        .section-title { text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); margin: 20px 0 10px; }
        
        input[type="date"] {
            background: #222;
            border: 1px solid #444;
            color: white;
            padding: 15px;
            border-radius: 12px;
            width: 100%;
            margin-bottom: 10px;
            font-family: inherit;
            font-size: 1rem;
            box-sizing: border-box;
        }

        .slots { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 30px; }
        .slot-btn {
            background: #222;
            border: 1px solid #444;
            color: #fff;
            padding: 12px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: 0.3s;
        }
        .slot-btn.active {
            background: var(--primary);
            border-color: var(--primary);
        }

        .confirm-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 18px;
            width: 100%;
            border-radius: 15px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: 0.4s;
            box-shadow: 0 10px 20px rgba(227, 24, 55, 0.3);
        }
        .confirm-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(227, 24, 55, 0.5); }
        
        .footer-note { font-size: 0.75rem; color: #555; margin-top: 25px; line-height: 1.4; }
    </style>
</head>
<body>
    <div class="card">
        <img src="https://images.weserv.nl/?url=https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Mahindra_Automotive_logo.svg/1200px-Mahindra_Automotive_logo.svg.png" class="logo" alt="Mahindra">
        <h1>Schedule Test Drive</h1>
        <p>Vehicle: <b>${carName}</b></p>

        <div class="section-title">Step 1: Choose Date</div>
        <input type="date" id="datePicker" min="${new Date().toISOString().split('T')[0]}">

        <div class="section-title">Step 2: Choose Time</div>
        <div class="slots" id="slotContainer">
            <button class="slot-btn" onclick="selectSlot(this, '10:00 AM')">10:00 AM (Morning)</button>
            <button class="slot-btn" onclick="selectSlot(this, '11:00 AM')">11:00 AM (Morning)</button>
            <button class="slot-btn" onclick="selectSlot(this, '02:00 PM')">02:00 PM (Afternoon)</button>
            <button class="slot-btn" onclick="selectSlot(this, '04:00 PM')">04:00 PM (Evening)</button>
        </div>

        <button class="confirm-btn" onclick="finalizeBooking()">Confirm Booking</button>
        
        <div class="footer-note">Selecting 'Confirm' will open your WhatsApp to complete the registration.</div>
    </div>

    <script>
        let selectedTime = "";
        
        function selectSlot(btn, time) {
            document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTime = time;
        }

        function finalizeBooking() {
            const dateVal = document.getElementById('datePicker').value;
            if (!dateVal || !selectedTime) {
                alert("Please select both Date and Time! 😊");
                return;
            }

            const d = new Date(dateVal);
            const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            
            // Dynamic Bot Number Redirect
            const botNumber = "${botPhone || "15558689519"}"; 
            const text = encodeURIComponent(\`CONFIRM_BOOKING:\${dateStr}|\${selectedTime}\`);
            window.location.href = \`https://wa.me/\${botNumber}?text=\${text}\`;
        }
    </script>
</body>
</html>
    `;
    res.send(html);
});

export default router;
