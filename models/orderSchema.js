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
       status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
        default: 'pending'
      },
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
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled',
       'return_requested', 'returned', 'partially_returned','partially_cancelled'],
    default: 'pending'
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