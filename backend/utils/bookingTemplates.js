/**
 * Interactive Message Templates for Mahindra Booking
 */

export const getBookButton = () => ({
    type: "button",
    body: { text: "Test Drive: It's a quick 2-step, 1-minute process." },
    action: {
        buttons: [
            { type: "reply", reply: { id: "action_book_test_drive", title: "Book Test Drive" } }
        ]
    }
});

export const getDateList = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const label = new Intl.DateTimeFormat('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
        }).format(d);
        dates.push({
            id: `date_${i}`,
            title: label,
            description: i === 0 ? "Today" : (i === 1 ? "Tomorrow" : "Upcoming slot")
        });
    }

    return {
        type: "list",
        header: { type: "text", text: "Test Drive Calendar" },
        body: { text: "What day should I block for your test drive? 🗓️" },
        footer: { text: "Mahindra Automobile" },
        action: {
            button: "Calendar",
            sections: [
                {
                    title: "Next 7 Days",
                    rows: dates
                }
            ]
        }
    };
};

export const getSlotList = (date) => ({
    type: "list",
    header: { type: "text", text: "Select a Time Slot" },
    body: { text: `We have several slots available for ${date}. Which one works best for you?` },
    footer: { text: "Mahindra Automobile" },
    action: {
        button: "Choose Slot",
        sections: [
            {
                title: "Morning",
                rows: [
                    { id: "slot_10am", title: "10:00 AM", description: "Fresh Start" },
                    { id: "slot_11am", title: "11:00 AM", description: "Mid Morning" }
                ]
            },
            {
                title: "Afternoon",
                rows: [
                    { id: "slot_02pm", title: "02:00 PM", description: "Lunch Break" },
                    { id: "slot_04pm", title: "04:00 PM", description: "Evening Drive" }
                ]
            }
        ]
    }
});
