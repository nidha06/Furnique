const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Payment = require('../../models/paymentSchema');
const Coupon = require('../../models/couponSchema');
const Wallet = require('../../models/walletSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckout = async (req, res) => {
  try {
    const user = req.session.user;
    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!user) {
      res.redirect('/login');
    }

    const address = await Address.findOne({ userId: user }).populate('userId');
    const cart = await Cart.findOne({ user }).populate('items.product');
    const wallet = await Wallet.findOne({ user });

    res.render('checkout', {
      cart,
      coupons,
      wallet: wallet || { balance: 0 },
      addresses: address ? address.address : [],
      razorpayId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.log(error);
    res.redirect('/cart');
  }
};

const processWalletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
    }

    const result = await paymentController.processWalletPayment(userId, amount);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in wallet payment route:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getOrderSuccess = async (req, res) => {
  try {
    const { selectedAddressId, paymentMethod } = req.body;
    const userId = req.session.user;

    if (!userId || !selectedAddressId || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const userCart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!userCart || userCart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    const addressDetails = await Address.findOne({ userId });
    let selectedAddress;
    if (addressDetails) {
      selectedAddress = addressDetails.address.id(selectedAddressId);
    }
    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: 'Selected address not found.' });
    }

    const items = userCart.items.map((item) => ({
      product: item.product._id,
      productName: item.product.productName,
      quantity: item.quantity,
      price: item.product.salePrice,
      images: item.product.images[0],
    }));

    for (const item of userCart.items) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.product._id}` });
      }
      if (item.quantity > product.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock available for ${product.productName}` });
      }
    }

    for (const item of userCart.items) {
      const product = await Product.findById(item.product._id);
      product.quantity -= item.quantity;
      await product.save();
    }

    const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);

    if (paymentMethod === 'wallet') {
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = await walletController.initializeWallet(userId);
      }

      if (wallet.balance < totalPrice) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
      }

      wallet.balance -= totalPrice;

      const order = new Order({
        user: userId,
        shippingAddress: {
          addressType: selectedAddress.addressType,
          name: selectedAddress.name,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          phone: selectedAddress.phone,
          altPhone: selectedAddress.altPhone || '',
        },
        paymentMethod,
        items,
        totalPrice,
        status: 'success', // Wallet payment is successful if balance is sufficient
      });

      await order.save();

      userCart.items = [];
      await userCart.save();

      wallet.transactions.push({
        amount: -totalPrice,
        type: 'debit',
        orderId: order._id,
        description: `Payment for order ${order._id}`,
      });

      await wallet.save();
    }

    const order = new Order({
      user: userId,
      shippingAddress: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone || '',
      },
      paymentMethod,
      items,
      totalPrice,
      status: 'pending', // Default to pending for non-wallet payments
    });

    await order.save();

    userCart.items = [];
    await userCart.save();

    res.status(201).json({ success: true, message: 'Order placed successfully.', orderId: order._id });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { total } = req.body;

    if (!total || total <= 0) {
      return res.status(400).json({ error: 'Invalid amount for wallet transaction' });
    }

    const amountInPaisa = total * 100;

    const options = {
      amount: amountInPaisa,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return res.json({
      success: true,
      order: order,
    });
  } catch (error) {
    console.error('Razorpay order error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      selectedAddressId,
      paymentMethod,
      coupon,
      orderId, // New parameter for retry
    } = req.body;

    // Validate Razorpay signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    let order;
    const Pstatus = 'success'; // Payment status

    if (orderId) {
      // Retry payment scenario: Update the existing order
      console.log(`Retrying payment for orderId: ${orderId}`); // Debug log

      // Validate orderId format
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, error: 'Invalid order ID' });
      }

      order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      // Update order status to a valid value
      order.status = 'processing';
      order.paymentStatus = Pstatus;
      order.razorpay_payment_id = razorpay_payment_id; // Keep this in Order schema if needed
      await order.save();

      // Validate req.session.user
      if (!req.session.user) {
        console.error('Session user is undefined');
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // Validate totalPrice
      if (typeof order.totalPrice !== 'number' || isNaN(order.totalPrice)) {
        console.error(`Invalid totalPrice for order ${orderId}: ${order.totalPrice}`);
        return res.status(500).json({ success: false, error: 'Invalid total price in order' });
      }

      // Update the existing payment record or create a new one
      // Since "order" is not in the schema, query by user and totalPrice (not ideal, but based on existing fields)
      await Payment.findOneAndUpdate(
        { user: req.session.user, totalPrice: order.totalPrice },
        {
          user: req.session.user,
          paymentMethod: paymentMethod || order.paymentMethod,
          totalPrice: order.totalPrice,
          currency: 'INR',
          status: Pstatus,
          updatedAt: new Date(),
        },
        { new: true, upsert: true }
      );
    } else {
      // New order scenario: Create a new order
      order = await createOrderInDB(req, res, paymentMethod, razorpay_payment_id, coupon, Pstatus);

      // Update order status
      order.status = 'processing';
      await order.save();

      // Validate req.session.user
      if (!req.session.user) {
        console.error('Session user is undefined');
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // Validate totalPrice
      if (typeof order.totalPrice !== 'number' || isNaN(order.totalPrice)) {
        console.error(`Invalid totalPrice for new order: ${order.totalPrice}`);
        return res.status(500).json({ success: false, error: 'Invalid total price in order' });
      }

      // Create a new payment record
      const payment = new Payment({
        user: req.session.user,
        paymentMethod: paymentMethod,
        totalPrice: order.totalPrice,
        currency: 'INR',
        status: Pstatus,
      });
      await payment.save();
    }

    res.status(200).json({ success: true, message: 'Order placed successfully', orderId: order._id });
  } catch (error) {
    console.error('Payment verification error:', error.message, error.stack);
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};
const handlePaymentFailure = async (req, res) => {
  try {
    const { razorpay_order_id, selectedAddressId, paymentMethod, coupon, total } = req.body;
    const Pstatus = 'failed';

    console.log(req.body);

    // Check if a failed order already exists with this razorpay_order_id
    let failedOrder = await Order.findOne({ razorpay_order_id });
    if (!failedOrder) {
      // Save failed order with pending status if it doesn't exist
      failedOrder = await createOrderInDB(req, res, paymentMethod, razorpay_order_id, coupon, Pstatus);
    }

    console.log(failedOrder);

    // Ensure the order status is valid
    if (failedOrder.status !== 'pending') {
      failedOrder.status = 'pending';
      await failedOrder.save();
    }

    // Update or create payment record with failed status
    await Payment.findOneAndUpdate(
      { user: req.session.user, totalPrice: total },
      {
        user: req.session.user,
        paymentMethod: failedOrder.paymentMethod,
        totalPrice: total,
        currency: 'INR',
        status: Pstatus,
        updatedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    // Respond with failure and redirect instruction
    res.status(400).json({
      success: false,
      message: 'Payment failed. Redirecting to order details.',
      orderId: failedOrder._id,
      redirectUrl: `/order-details/${failedOrder._id}`,
    });
  } catch (error) {
    console.error('Payment failure handling error:', error);
    res.status(500).json({ success: false, error: 'Failed to handle payment failure' });
  }
};

// const saveFailedOrder = async (req,orderId, selectedAddressId, paymentMethod, coupon) => {
//   try {
//     const userId = req.session.user;
//     const userCart = await Cart.findOne({ user: userId }).populate('items.product');

//     if (!userCart || userCart.items.length === 0) {
//       throw new Error('Cart is empty.');
//     }

//     const addressDetails = await Address.findOne({ userId });
//     const selectedAddress = addressDetails.address.id(selectedAddressId);

//     const items = userCart.items.map((item) => ({
//       product: item.product._id,
//       productName: item.product.productName,
//       quantity: item.quantity,
//       price: item.product.salePrice,
//       images: item.product.images[0],
//     }));

//     const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
//     let couponDiscount = 0;
//     if (coupon) {
//       const couponDoc = await Coupon.findOne({ code: coupon.code, isActive: true, expiryDate: { $gt: new Date() } });
//       if (couponDoc) {
//         if (couponDoc.discountType === 'percentage') {
//           couponDiscount = Math.min((totalPrice * couponDoc.discountAmount) / 100, couponDoc.maxLimit || Infinity);
//         } else if (couponDoc.discountType === 'fixed') {
//           couponDiscount = couponDoc.discountAmount;
//         }
//       }
//     }

//     const discountedPrice = totalPrice - couponDiscount;

//     const failedOrder = new Order({
//       user: userId,
//       shippingAddress: {
//         addressType: selectedAddress.addressType,
//         name: selectedAddress.name,
//         city: selectedAddress.city,
//         state: selectedAddress.state,
//         pincode: selectedAddress.pincode,
//         phone: selectedAddress.phone,
//         altPhone: selectedAddress.altPhone || '',
//       },
//       paymentMethod,
//       items,
//       totalPrice: discountedPrice,
//       appliedCoupon: coupon,
//       status: 'pending', // Order remains pending until payment succeeds
//       razorpay_order_id: orderId,
//     });

//     await failedOrder.save();

//     // Do not clear cart or deduct stock yet (pending status)
//     console.log(`Failed order saved with ID: ${failedOrder._id}. Notify user for retry.`);

//     return failedOrder;
//   } catch (error) {
//     console.error('Error saving failed order:', error);
//     throw error;
//   }
// };

const createOrderInDB = async (req, res, paymentMethod, razorpay_payment_id, couponCode,Pstatus) => {
  try {
    const { selectedAddressId } = req.body;
    const userId = req.session.user;

    const userCart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!userCart || userCart.items.length === 0) {
      throw new Error('Cart is empty.');
    }

    const addressDetails = await Address.findOne({ userId });
    let selectedAddress;
    if (addressDetails) {
      selectedAddress = addressDetails.address.id(selectedAddressId);
    }
    if (!selectedAddress) {
      throw new Error('Selected address not found.');
    }

    let appliedCoupon = null;
    let couponDiscount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.code,
        isActive: true,
        expiryDate: { $gt: new Date() },
      });

      if (!coupon) {
        throw new Error('Invalid or expired coupon.');
      }

      const totalPrice = userCart.items.reduce((total, item) => total + item.product.salePrice * item.quantity, 0);

      if (totalPrice < coupon.minPurchase) {
        throw new Error(`Minimum purchase amount for this coupon is ₹${coupon.minPurchase}`);
      }

      if (coupon.discountType === 'percentage') {
        couponDiscount = Math.min((totalPrice * coupon.discountAmount) / 100, coupon.maxLimit || Infinity);
      } else if (coupon.discountType === 'fixed') {
        couponDiscount = coupon.discountAmount;
      }

      appliedCoupon = {
        code: coupon.code,
        discountAmount: couponDiscount,
      };
    }

    const items = userCart.items.map((item) => ({
      product: item.product._id,
      productName: item.product.productName,
      quantity: item.quantity,
      price: item.product.salePrice,
      images: item.product.images[0],
    }));

    for (const item of userCart.items) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        throw new Error(`Product not found: ${item.product._id}`);
      }
      if (item.quantity > product.quantity) {
        throw new Error(`Not enough stock available for ${product.productName}`);
      }
    }

    for (const item of userCart.items) {
      const product = await Product.findById(item.product._id);
      product.quantity -= item.quantity;
      await product.save();
    }

    const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
    const discountedPrice = totalPrice - couponDiscount;

    const order = new Order({
      user: userId,
      shippingAddress: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone || '',
      },
      paymentMethod,
      items,
      totalPrice: discountedPrice,
      appliedCoupon,
      razorpay_payment_id,
      status: Pstatus==='failed' ? 'pending' : 'processing',
      paymentStatus:Pstatus,
    });

    await order.save();

    userCart.items = [];
    await userCart.save();

    return order;
  } catch (error) {
    console.error('Error creating order in DB:', error.message, error.stack);
    throw error;
  }
};

module.exports = {
  getOrderSuccess,
  getCheckout,
  createRazorpayOrder,
  verifyPayment,
  processWalletPayment,
  handlePaymentFailure,
};