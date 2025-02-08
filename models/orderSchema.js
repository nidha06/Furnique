const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // User who placed the order
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true
    },

    // Shipping Address
    shippingAddress: {
        addressType: { type: String, required: true }, // e.g., Home, Office
        name: { type: String, required: true },
        city: { type: String, required: true },
        landMark: { type: String, required: false },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        phone: { type: String, required: true },
        altPhone: { type: String, required: false }
    },

    // Payment Method
    paymentMethod: {
        type: String,
        enum: ['credit', 'paypal', 'cod'], // Credit/Debit Card, PayPal, Cash on Delivery
        default: 'cod'
    },

    // Order Items (Products in the cart)
    items: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product', // Reference to the Product model
                required: true
            },
            productName: { type: String, required: true }, // Store product name for reference
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true, min: 0 } // Price at the time of purchase
        }
    ],

    // Total Price of the Order
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },

    // Order Status
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled','ordered'],
        default: 'ordered'
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update `updatedAt` field before saving
orderSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Order', orderSchema);