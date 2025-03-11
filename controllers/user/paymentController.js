const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Payment = require('../../models/paymentSchema');
const Coupon = require('../../models/couponSchema');
const Wallet = require('../../models/walletSchema')
const Razorpay = require('razorpay');
const crypto = require('crypto');
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
  
      res.render('checkout', { cart, coupons,wallet: wallet || { balance: 0 }  , addresses: address ? address.address : [],razorpayId:process.env.RAZORPAY_KEY_ID });
    } catch (error) {
      console.log(error);
      res.redirect('/cart');
    }
  };

  const processWalletPayment = async (req,res) => {
    try {
      const userId = req.session.user;
      const { amount } = req.body; // Get amount from request body

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

      const items = userCart.items.map(item => ({
          product: item.product._id,
          productName: item.product.productName,
          quantity: item.quantity,
          price: item.product.salePrice,
          images: item.product.images[0]
      }));

      // Check product stock availability
      for (const item of userCart.items) {
          const product = await Product.findById(item.product._id);
          if (!product) {
              return res.status(404).json({ success: false, message: `Product not found: ${item.product._id}` });
          }
          if (item.quantity > product.quantity) {
              return res.status(400).json({ success: false, message: `Not enough stock available for ${product.productName}` });
          }
      }

      // Deduct stock
      for (const item of userCart.items) {
          const product = await Product.findById(item.product._id);
          product.quantity -= item.quantity;
          await product.save();
      }

      const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);

      // **Handle Wallet Payment**
      if (paymentMethod === 'wallet') {
          let wallet = await Wallet.findOne({ user: userId });
          if (!wallet) {
              wallet = await walletController.initializeWallet(userId); // Initialize wallet if not found
          }

          if (wallet.balance < totalPrice) {
              return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
          }

          wallet.balance -= totalPrice; // Deduct balance

          

          const order = new Order({
            user: userId,
            shippingAddress: {
                addressType: selectedAddress.addressType,
                name: selectedAddress.name,
                city: selectedAddress.city,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                phone: selectedAddress.phone,
                altPhone: selectedAddress.altPhone || ''
            },
            paymentMethod,
            items,
            totalPrice
        });

        await order.save();

    
      // **Clear the cart after order placement**
      userCart.items = [];
      await userCart.save();
      
      wallet.transactions.push({
              amount: -totalPrice,
              type: 'debit',
              orderId: order._id, // Store order ID
              description: `Payment for order`
          });

          await wallet.save(); // Save updated balance
      }

      res.status(201).json({ success: true, message: 'Order placed successfully.', orderId: Order._id });
  } catch (error) {
      console.error('Error placing order:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


const createRazorpayOrder = async (req, res) => {
    try {
        let { total } = req.body;

        if (!total || total <= 0) {
            return res.status(400).json({ error: "Invalid amount for wallet transaction" });
        }

        // Convert amount to paisa
        const amountInPaisa = total * 100;

        const options = {
            amount: amountInPaisa,
            currency: "INR",
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, selectedAddressId, paymentMethod, coupon } = req.body;

    console.log(req.body)
    // Create signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // If verification successful, create order
    await createOrderInDB(req, res, paymentMethod, razorpay_payment_id, coupon);
    res.status(200).json({ success: true, message: 'Order placed successfully' });
  } catch (error) {
    console.error('Payment verification error:', error.message, error.stack);
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
};


  const createOrderInDB = async (req, res, paymentMethod, razorpay_payment_id, couponCode) => {
    try {
      
      const { selectedAddressId } = req.body;
      const userId = req.session.user;
  
      // Fetch the user's cart
      const userCart = await Cart.findOne({ user: userId }).populate('items.product');
      if (!userCart || userCart.items.length === 0) {
        throw new Error('Cart is empty.');
      }
  
      // Fetch the user's address details
      const addressDetails = await Address.findOne({ userId });
      let selectedAddress;
      if (addressDetails) {
        selectedAddress = addressDetails.address.id(selectedAddressId);
      }
      if (!selectedAddress) {
        throw new Error('Selected address not found.');
      }
  
      // Validate and fetch coupon details
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
  
        // Calculate discount based on coupon type
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
  
  
      // Prepare order items
      const items = userCart.items.map(item => ({
        product: item.product._id,
        productName: item.product.productName,
        quantity: item.quantity,
        price: item.product.salePrice,
        images: item.product.images[0],
      }));
  
      // Check stock availability
      for (const item of userCart.items) {
        const product = await Product.findById(item.product._id);
        if (!product) {
          throw new Error(`Product not found: ${item.product._id}`);
        }
        if (item.quantity > product.quantity) {
          throw new Error(`Not enough stock available for ${product.productName}`);
        }
      }
  
      // Deduct stock quantities
      for (const item of userCart.items) {
        const product = await Product.findById(item.product._id);
        product.quantity -= item.quantity;
        await product.save();
      }
  
      // Calculate total price after applying coupon discount
      const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
      const discountedPrice = totalPrice - couponDiscount;
  
      // Create the order in the database
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
        totalPrice: discountedPrice, // Save the discounted price
        appliedCoupon, // Save the coupon details
        razorpay_payment_id,
      });
  
      await order.save();
  
      // Clear the cart
      userCart.items = [];
      await userCart.save();
  
      return order; // Return the created order for further use
    } catch (error) {
      console.error('Error creating order in DB:', error.message, error.stack);
      throw error; // Propagate the error to the calling function
    }
  };

module.exports={
    getOrderSuccess,
    getCheckout,
    createRazorpayOrder,
    verifyPayment,
    processWalletPayment
}