const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Reference to the user who made the payment
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Payment method used (e.g., COD, Credit/Debit Card, PayPal, Razorpay)
  paymentMethod: {
    type: String,
    enum: ['cod', 'wallet', 'payPal', 'razorpay'], // Add all valid payment methods here
    required: true,
  },

  // Total amount paid
  totalPrice: {
    type: Number,
    required: true,
  },

  // Currency of the payment
  currency: {
    type: String,
    default: 'INR', // Default to INR or your preferred currency
  },

  // Razorpay-specific details (if applicable)
  razorpay: {
    orderId: {
      type: String,
      required: function () {
        return this.paymentMethod === 'Razorpay'; // Required only if paymentMethod is Razorpay
      },
    },
    paymentId: {
      type: String,
      required: function () {
        return this.paymentMethod === 'Razorpay'; // Required only if paymentMethod is Razorpay
      },
    },
    signature: {
      type: String,
      required: function () {
        return this.paymentMethod === 'Razorpay'; // Required only if paymentMethod is Razorpay
      },
    },
  },

  // Status of the payment
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  },

  // Timestamps for when the payment was created and updated
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update the `updatedAt` field before saving
paymentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Payment model
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;