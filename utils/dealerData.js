export const dealers = [
    { city: "Mumbai", pincodes: ["400018", "400001", "400013", "400069"], name: "NBS International", address: "Dr. Annie Besant Road, Worli", phone: "022-24901111" },
    { city: "Delhi", pincodes: ["110001", "110020", "110044"], name: "Koncept Mahindra", address: "Okhla Industrial Estate, Phase III", phone: "011-41612222" },
    { city: "Bangalore", pincodes: ["560001", "560042", "560037"], name: "Siren Automotives", address: "Lavelle Road, Central Bangalore", phone: "080-22233344" },
    { city: "Pune", pincodes: ["411001", "411004", "411014"], name: "Sahyadri Motors", address: "Baner Road, Pune", phone: "020-27299999" },
    { city: "Ahmedabad", pincodes: ["380001", "380009", "380015"], name: "Punjab Mahindra", address: "S.G. Highway, Ahmedabad", phone: "079-26855555" },
    { city: "Chennai", pincodes: ["600001", "600017", "600034"], name: "Zulaikha Motors", address: "Ambattur Industrial Estate", phone: "044-24355555" },
    { city: "Hyderabad", pincodes: ["500001", "500033", "500081"], name: "Automotive Mahindra", address: "Jubilee Hills, Hyderabad", phone: "040-23555555" },
    { city: "Surat", pincodes: ["395007", "395001", "395003", "395009"], name: "Infinity Mahindra", address: "Adajan Road, Surat", phone: "0261-2777777" }
];

export const getDealerByPincode = (pincode) => {
    return dealers.find(d => d.pincodes.includes(pincode));
};
