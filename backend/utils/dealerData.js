export const dealers = [
    { 
        city: "Mumbai", 
        locations: [
            { pincode: "400018", area: "Worli", name: "NBS International", address: "Dr. Annie Besant Road, Worli", phone: "022-24901111" },
            { pincode: "400001", area: "Fort/Colaba", name: "NBS International", address: "Nariman Point, Mumbai", phone: "022-24901111" },
            { pincode: "400071", area: "Chembur", name: "Salasar Mahindra", address: "Chembur Naka, Mumbai", phone: "022-25221111" }
        ]
    },
    { 
        city: "Delhi", 
        locations: [
            { pincode: "110001", area: "Connaught Place", name: "Koncept Mahindra", address: "Plot No. 1, Okhla PH-3", phone: "011-41612222" },
            { pincode: "110020", area: "Okhla", name: "Koncept Mahindra", address: "Okhla Industrial Estate, Phase III", phone: "011-41612222" }
        ]
    },
    { 
        city: "Nashik", 
        locations: [
            { pincode: "422001", area: "Nashik City", name: "Jitendra Mahindra", address: "Mumbai-Agra Highway, Nashik", phone: "0253-2222222" },
            { pincode: "422003", area: "Panchavati", name: "Jitendra Mahindra", address: "Adgaon, Nashik", phone: "0253-2222222" }
        ]
    },
    { 
        city: "Pune", 
        locations: [
            { pincode: "411001", area: "Pune City", name: "Sahyadri Mahindra", address: "Baner Road, Pune", phone: "020-22222222" },
            { pincode: "411045", area: "Baner", name: "Silver Jubilee Mahindra", address: "Baner, Pune", phone: "020-22222222" }
        ]
    },
    { 
        city: "Jalgaon", 
        locations: [
            { pincode: "425001", area: "Jalgaon City", name: "Ganesh Mahindra", address: "Nasirabad Highway, Jalgaon", phone: "0257-2211111" }
        ]
    },
    { 
        city: "Surat", 
        locations: [
            { pincode: "395007", area: "Vesu", name: "Infinity Mahindra (Vesu Branch)", address: "Opp. Someshwara Enclave, Vesu Main Road, Surat", phone: "0261-2777777" },
            { pincode: "395001", area: "Station Road", name: "Infinity Mahindra", address: "Station Road, Near Railway Station, Surat", phone: "0261-2777777" },
            { pincode: "395003", area: "Varachha", name: "Infinity Mahindra", address: "Varachha Main Road, Surat", phone: "0261-2777777" }
        ]
    },
    { 
        city: "Ahmedabad", 
        locations: [
            { pincode: "380015", area: "S.G. Highway", name: "Punjab Mahindra", address: "S.G. Highway, Near PVR, Ahmedabad", phone: "079-26855555" }
        ]
    }
];

export const getDealerByPincode = (pincode) => {
    for (const city of dealers) {
        const found = city.locations.find(l => l.pincode === String(pincode));
        if (found) return { ...found, city: city.city };
    }
    return null;
};
