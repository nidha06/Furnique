const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');


exports.addToCart = async (req, res) => {
    try {
        const user = req.session.user;
        const { productId } = req.body;

        if (!user) {
            return res.status(400).json({ error: "User authentication required" });
        }
        const product = await Product.findById(productId);

        let cart = await Cart.findOne({ user });
        if (!cart) {
            cart = new Cart({ user, items: [{ product }] });
        }
        cart.items.push({
            product,
            quantity: 1,
        });

        await cart.save();

        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

exports.getCart = async (req, res) => {
    try {
        const user = req.session.user;

        if (!user) {
            return res.redirect('/login');
        }
        const cart = await Cart.findOne({ user }).populate('items.product');
        res.render('cart', { cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

exports.removeCart = async (req, res) => {
    try {
        const user = req.session.user;
        const { productId } = req.body;

        if (!user) {
            return res.status(400).json({ error: "User authentication required" });
        }

        let cart = await Cart.findOne({ user });
        if (!cart) {
            return res.status(404).json({ error: "Cart not found" });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        await cart.save();
        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

exports.getCheckout = async (req, res) => {
    try {
        const user = req.session.user;

        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        if (!user) {
            res.redirect('/login');
        }

        const address = await Address.findOne({ userId: user }).populate('userId');
        const cart = await Cart.findOne({ user }).populate('items.product');
        console.log(coupons);
        
        res.render('checkout', { cart, coupons, addresses: address ? address.address : [] });
    } catch (error) {
        console.log(error);
        res.redirect('/cart');
    }
};

exports.updateCart = async (req, res) => {
    const { productId, quantity } = req.body;

    try {
        if (!productId || !quantity || isNaN(quantity) || quantity < 1) {
            return res.status(400).json({ success: false, message: 'Invalid product ID or quantity.' });
        }

        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }

        const userCart = await Cart.findOne({ user: userId });
        if (!userCart) {
            return res.status(404).json({ success: false, message: 'Cart not found.' });
        }

        const itemIndex = userCart.items.findIndex(item => item.product.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart.' });
        }

        userCart.items[itemIndex].quantity = parseInt(quantity);
        await userCart.save();

        return res.json({ success: true, message: 'Cart updated successfully.' });
    } catch (error) {
        console.error('Error updating cart:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

exports.getOrderSuccess = async (req, res) => {
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

// In your user controller file
exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode, subtotal } = req.body;
        
        // Find the coupon in the database
        const coupon = await Coupon.findOne({
            code: couponCode,
            isActive: true,
            expiryDate: { $gt: new Date() }
        });
        
        if (!coupon) {
            return res.json({
                success: false,
                message: 'Invalid or expired coupon code'
            });
        }
        
        // Check minimum purchase requirement
        if (subtotal < coupon.minPurchase) {
            return res.json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} required for this coupon`
            });
        }
        
        
        // Calculate discount
        let discountAmount;
        if (coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountAmount) / 100;
            if(discountAmount >= coupon.maxLimit){
                discountAmount = coupon.maxLimit;
            }
        
        } else {
            discountAmount = coupon.discountAmount;
        }

        
        res.json({
            success: true,
            discountAmount,
            message: 'Coupon applied successfully'
        });
        
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.json({
            success: false,
            message: 'An error occurred while applying the coupon'
        });
    }
};

exports.getActiveCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: new Date() }
        }).sort({ createdAt: -1 });
        
        // If this is an API request
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json(coupons);
        }
        
        // If rendering the page, pass coupons to the template
        res.render('checkout', { coupons });
    } catch (error) {
        console.error('Error fetching active coupons:', error);
        res.status(500).send('Error fetching coupons');
    }
};

