const { session } = require('passport');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');

const getOrderList = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt returnRequest');
        if (!orders || orders.length === 0) {
            return res.json({ success: false, message: "No orders found." });
        }

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
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt cancellationReason returnRequest');
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const itemsWithImages = await Promise.all(
            order.items.map(async (item) => {
                const product = await Product.findById(item.product);
                return {
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    image: product?.images?.[0] || 'default-image.jpg',
                };
            })
        );

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
            items: itemsWithImages,
            totalPrice: order.totalPrice,
            status: order.status,
            cancellationReason: order.cancellationReason,
            createdAt: order.createdAt,
            returnRequest: order.returnRequest || null,
        };
         console.log('simplified:',simplifiedOrder);
        res.render('admin-order-details', { order: simplifiedOrder });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send('Internal Server Error');
    }
};
const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled.' });
        }
        
        if(paymentMethod==='razorpay'){
            let wallet = await Wallet.findOne({user});
      
            if(!wallet){
               wallet= new Wallet({
                user,
                balance:0,
                transactions:[],
              })
              await wallet.save()
            }
            wallet.balance +=totalPrice
        
            wallet.transactions.push({
              amount:order.totalPrice,
              type:'credit',
              orderId:order._id,
              description:`Order Refund : ${order._id}`,
            })
        
            await wallet.save()
          }
          order.status = 'cancelled';
        await order.save();
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
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID.' });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        if (order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'The status of this order cannot be changed anymore.' });
        }
        order.status = status.toLowerCase();
        await order.save();
        return res.json({ success: true, message: 'Order status updated successfully.' });
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const successReturn= async (req, res) => {
    try {
      const { orderId } = req.params;
  
      
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
  
      // Check if the order has a pending return request
      if (!order.returnRequest || order.returnRequest.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'No pending return request for this order.' });
      }
  
      // Update the return request status to "approved"
      order.returnRequest.status = 'approved';
      order.returnRequest.approvalDate = new Date();
  
      // Update the order status to "returned"
      order.status = 'returned';
  
      // Save the updated order
      await order.save();
  
      res.status(200).json({ success: true, message: 'Return request approved successfully.' });
    } catch (error) {
      console.error('Error approving return request:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  };

module.exports = {
    getOrderList,
    getOrderDetails,
    cancelOrder,
    updateOrderStatus,
    successReturn,
};