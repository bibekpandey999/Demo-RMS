const mongoose = require("mongoose");

const restaurantMenuSchema = mongoose.Schema({
    itemName: {
        type: String,
        required: true, 
    },
    description: {
        type: String,
        required: true, 
    },
    category: {
        type: String,
        required: true,
    },
    price: {       
        type: Number, 
        required: true,
    },
    status: {
        type: String,
        default: "Available",
    },
    skuBarcodeReference: {
        type: String,
        sparse: true, 
    },
    restaurantId: {
        type: String,
        required: true,
    },
},
{
    timestamps: true, 
});

const Menu = mongoose.model("RestaurantMenu", restaurantMenuSchema);
module.exports = Menu;