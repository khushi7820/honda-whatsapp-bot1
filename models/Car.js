import mongoose from "mongoose";

const carSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: String,
        required: true
    },
    type: {
        type: String, // SUV, Sedan, Hatchback, etc.
        required: true
    },

    mileage: {
        type: String,
        required: true
    },

    features: [String],

    description: {
        type: String,
        required: true
    },

    imageUrl: {
        type: String,
        required: false
    },

    images: [String], // Array for multiple car images

    colors: [String],

    fuelType: {
        type: String,
        required: true
    }
});

const Car = mongoose.model("Car", carSchema);
export default Car;
