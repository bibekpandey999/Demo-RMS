const mongoose = require("mongoose");

const tableSchema = mongoose.Schema({
    restaurantId: {
        type: String,
        required: true,
    },
    tableName: {
        type: String,
        required: true,
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        default: 2,
    },
    status: {
        type: String,
        enum: ["Available", "Occupied", "Reserved"],
        default: "Available",
    },
  
},
{
    timestamps: true,
});

const Table = mongoose.model("RestaurantTable", tableSchema);
module.exports = Table;