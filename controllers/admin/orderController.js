const { session } = require('passport');
const mongoose = require('mongoose');

const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

const getOrderList = async (req, res) => {
    try {
        
        
        const orders = await Order.find()
            .populate('user', 'name email') // Only fetch user's name and email
            .select('shippingAddress paymentMethod items totalPrice status createdAt'); // Select only required fields

        // console.log("Fetched Orders:", orders); // Debugging log

        if (!orders || orders.length === 0) {
            return res.json({ success: false, message: "No orders found." });
        }


        // Transform the data to match the frontend's requirements
        const simplifiedOrders = await Promise.all(
            orders.map(async (order) => {
                const itemsWithImages = await Promise.all(
                    order.items.map(async (item) => {
                        const product = await Product.findById(item.product);

                        return {
                            productName: item.productName,
                            quantity: item.quantity,
                            price: item.price,
                            image: product?.images[0] || ['default-image.jpg'], 
                            // Ensure `image` is always an array
                        };
                    })
                );
                
        
                return {
                    _id: order._id,
                    user: {
                        name: order.user?.name || 'Unknown User',
                        email: order.user?.email || 'Unknown Email',
                    },
                    shippingAddress: {
                        name: order.shippingAddress.name,
                        city: order.shippingAddress.city,
                        state: order.shippingAddress.state,
                        pincode: order.shippingAddress.pincode,
                    },
                    paymentMethod: order.paymentMethod,
                    items: itemsWithImages,
                    totalPrice: order.totalPrice,
                    status: order.status,
                    createdAt: order.createdAt,
                };
            })
        );
        
        
        res.render('orders', { orders: simplifiedOrders });
        //res.json({ success: true, orders: simplifiedOrders });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};





const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId; // Get the order ID from the URL parameter

        // Find the specific order by its ID and populate the user field
        const order = await Order.findById(orderId)
            .populate('user', 'name email') // Only fetch user's name and email
            .select('shippingAddress paymentMethod items totalPrice status createdAt'); // Select only required fields

        if (!order) {
            return res.status(404).send('Order not found'); // Handle case where order is not found
        }

        // Fetch product details for each item in the order
        const itemsWithImages = await Promise.all(
            order.items.map(async (item) => {
                const product = await Product.findById(item.product); // Fetch product details
                return {
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    image: product?.images?.[0] || 'default-image.jpg', // Use the first image or fallback
                };
            })
        );

        // Construct the simplified order object
        const simplifiedOrder = {
            _id: order._id,
            user: {
                name: order.user?.name || 'Unknown User',
                email: order.user?.email || 'Unknown Email',
            },
            shippingAddress: {
                name: order.shippingAddress.name,
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
            },
            paymentMethod: order.paymentMethod,
            items: itemsWithImages, // Items now include product images
            totalPrice: order.totalPrice,
            status: order.status,
            createdAt: order.createdAt,
        };

        // Debugging: Log the simplified order object


        // Render the order details page with the simplified order data
        res.render('admin-order-details', { order: simplifiedOrder });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send('Internal Server Error');
    }
};


const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId; // Get the order ID from the URL parameter

        // Find the order by its ID
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Check if the order is already cancelled
        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled.' });
        }

        // Update the order status to "Cancelled"
        order.status = 'cancelled';
        await order.save();

        // Return success response
        return res.json({ success: true, message: 'Order cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;

        // Validate the order ID
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID.' });
        }

        // Find the order by its ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Prevent updating if the order is already "delivered" or "cancelled"
        if (order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'The status of this order cannot be changed anymore.' });
        }

        // Update the order status
        order.status = status.toLowerCase(); // Ensure consistency
        await order.save();

        // Return success response
        return res.json({ success: true, message: 'Order status updated successfully.' });
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};




module.exports = {
    getOrderList,
    getOrderDetails,
    cancelOrder,
    updateOrderStatus,
};