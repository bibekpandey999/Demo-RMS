const mongoose = require("mongoose");

const orderItemSchema = mongoose.Schema({
    itemName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    itemPrice: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
}, { _id: false });

const createOrderSchema = mongoose.Schema({
    restaurantId: {
        type: String,
        required: true,
    },
    customerName: {
        type: String,
        required: true,
    },
    tableNumber: {
        type: String,
        required: true,
    },
    orderNote: {
        type: String,
    },
    items: {
        type: [orderItemSchema],
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    orderStatus: {
        type: String,
        enum: ["Pending","Served", "Preparing", "Ready", "Completed", "Cancelled"],
        default: "Pending",
    },
    paymentStatus: {
        type: String,
        enum: ["Unpaid", "Paid", "Refunded"],
        default: "Unpaid",
    },
},
{
    timestamps: true,
});

const Order = mongoose.model("RestaurantOrder", createOrderSchema);
module.exports = Order;