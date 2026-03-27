/**
 * Interactive Message Templates for Mahindra Booking
 */

export const getBookButton = (text) => ({
    type: "button",
    body: { text: text },
    action: {
        buttons: [
            { type: "reply", reply: { id: "action_book_test_drive", title: "Book Test Drive" } }
        ]
    }
});

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
