const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Payment = require('../../models/paymentSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });



const getCheckout = async (req, res) => {
    try {
        const user = req.session.user;

        if (!user) {
            res.redirect('/login');
        }

        const address = await Address.findOne({ userId: user }).populate('userId');
        const cart = await Cart.findOne({ user }).populate('items.product');

        res.render('checkout', { cart, addresses: address ? address.address : [] });
    } catch (error) {
        console.log(error);
        res.redirect('/cart');
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
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, selectedAddressId, paymentMethod } = req.body;
  
      console.log('Verifying payment with:', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        selectedAddressId,
        paymentMethod,
      });
  
      // Create signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');
  
      console.log('Generated Signature:', generatedSignature);
      console.log('Razorpay Signature:', razorpay_signature);
  
      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature' });
      }
  
      // If verification successful, create order
      await createOrderInDB(req, res, paymentMethod, null, razorpay_payment_id);
      res.status(200).json({ success: true, message: 'Order placed successfully' });
    } catch (error) {
      console.error('Payment verification error:', error.message, error.stack);
      res.status(500).json({ success: false, error: 'Payment verification failed' });
    }
  };


const createOrderInDB = async (req, res, paymentMethod, appliedCouponData, razorpay_payment_id) => {
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
  
      // Calculate total price
      const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
  
      // Create the order in the database
      const Payment = new Payment({
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
        razorpay_payment_id,
      });
  
      await Payment.save();
  
      // Clear the cart
      userCart.items = [];
      await userCart.save();
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
}