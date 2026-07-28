const mongoose = require("mongoose");

const billItemSchema = mongoose.Schema({
    itemName: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    rate: {
        type: Number,
        required: true,
        default: 0,
    },
    total: {
        type: Number,
        required: true,
    },
}, { _id: false });

const restaurantBillingSchema = mongoose.Schema({
    restaurantName: {
        type: String,
        required: true,
    },
    location: {
        type: String,
    },
    panOrVat: {
        type: String,
    },
    invoiceNo: {
        type: String,
        required: true,
    },
    billTo: {
        type: String, 
        default: "Guest",
    },
    tableNumber: {
        type: String,
    },
    paymentMethod: {
        type: String,
        enum: ["Cash", "eSewa", "Khalti", "IMEPay", "Card", "Due","Pending"],
        default: "Cash",
    },
    date: {
        type: Date,
        default: Date.now,
    },
    items: {
        type: [billItemSchema],
        required: true,
    },
    subtotal: {
        type: Number,
        required: true,
    },
    discount: {
        type: Number,
        default: 0,
    },
    taxableAmount: {
        type: Number,
    },
    vatCollected: {
        type: Number,
    },
    grandTotal: {
        type: Number,
        required: true,
    },
    restaurantId: {
        type: String,
        required: true,
    },
    orderId: {
    type: String,
},
},
{
    timestamps: true,
});

const Bill = mongoose.model("RestaurantBill", restaurantBillingSchema);
module.exports = Bill;