const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      productName: String,
      quantity: Number,
      price: Number,
      image: String,
    },
  ],
  shippingAddress: {
    name: String,
    city: String,
    state: String,
    pincode: String,
    phone: String,
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'paypal', 'razorpay'],
    required: true,
  },
  status: {
    type: String,
    enum: ['ordered', 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
    default: 'ordered',
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  appliedCoupon: {
    code: String,
    discountAmount: Number, 
  },
  returnRequest: {
    reason: String,
    details: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
    },
    requestDate: Date,
    approvalDate: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);