/**
 * Text-based Interactive Menus for Mahindra Booking (Standard Compatibility)
 */

export const getBookButton = () => {
    return "🚀 *Ready to Book your Test Drive?*\n\nReplies with 'BOOK' to start the process!";
};

export const getDateListText = () => {
    const dates = [];
    let text = "🗓️ *Select a Date for your Test Drive*\n\nPlease reply with the *Number* (1-7):\n\n";
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const label = new Intl.DateTimeFormat('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
        }).format(d);
        const desc = i === 0 ? "(Today)" : (i === 1 ? "(Tomorrow)" : "");
        text += `${i + 1}. *${label}* ${desc}\n`;
        dates.push({ id: `date_${i}`, title: label });
    }
    return text;
};

export const getSlotListText = (date) => {
    return `🕒 *Select a Time Slot for ${date}*\n\nPlease reply with the *Number*:\n\n1. *10:00 AM* (Morning)\n2. *11:00 AM* (Morning)\n3. *02:00 PM* (Afternoon)\n4. *04:00 PM* (Evening)`;
};

export const getColorListText = (carName, colors) => {
    let text = `🎨 *Select Color for your ${carName}*\n\nPlease reply with the *Number*:\n\n`;
    colors.slice(0, 8).forEach((c, i) => {
        text += `${i + 1}. *${c}*\n`;
    });
    return text;
};

export const getFuelListText = (carName, fuelTypeStr) => {
    const isBoth = fuelTypeStr.toLowerCase().includes("petrol") && fuelTypeStr.toLowerCase().includes("diesel");
    if (isBoth) {
        return `⛽ *Select Fuel Type for ${carName}*\n\nPlease reply with the *Number*:\n\n1. *Petrol*\n2. *Diesel*`;
    }
    return `⛽ *Fuel Type*: ${fuelTypeStr} (Standard)`;
};
