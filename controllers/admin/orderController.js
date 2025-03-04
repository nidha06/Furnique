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
                    _id: item._id,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    image: product?.images?.[0] || 'default-image.jpg',
                    status:item.status
                };
            })
        );
            console.log(itemsWithImages)
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
         //console.log('simplified:',simplifiedOrder);
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
        
        if(order.paymentMethod !=='cod'){

            let wallet = await Wallet.findOne({ user: order.user});
      
            if(!wallet){
               wallet= new Wallet({
                user,
                balance:0,
                transactions:[],
              })
              await wallet.save()
            }
            wallet.balance += order.totalPrice
        
            wallet.transactions.push({
              amount:order.totalPrice,
              type:'credit',
              orderId:order._id,
              description:`Order Refund : ${order._id}`,
            })
        
            await wallet.save()
          }
          order.status = 'cancelled';

          order.items.forEach(item=>{
            item.status='cancelled'
          })
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
        order.items.forEach(item=>{
            if(item.status !== 'cancelled'){
                item.status = order.status; 
            }
        })
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

  const approveItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        
        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        
        // Find the specific item in the order
        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }
        
        const item = order.items[itemIndex];
        
        // Check if the item has a pending return request
        if (!item.returnRequest || item.returnRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'No pending return request for this item.' });
        }
        
        // Update the return request status to "approved"
        order.items[itemIndex].returnRequest.status = 'approved';
        order.items[itemIndex].returnRequest.approvalDate = new Date();
        
        // Update the item status to "returned"
        order.items[itemIndex].status = 'returned';
        
        // Check order status - if all items are returned, change order status to "returned"
        if (order.items.every(item => item.status === 'returned')) {
            order.status = 'returned';
        } else {
            order.status = 'partially_returned';
        }
        
        // Process refund for the returned item
        if (order.paymentMethod === 'razorpay') {
            const userId = order.user;
            let wallet = await Wallet.findOne({ user: userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    user: userId,
                    balance: 0,
                    transactions: [],
                });
            }
            
            // Calculate refund amount for this specific item
            const refundAmount = item.price * item.quantity;
            
            wallet.balance += refundAmount;
            
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                orderId: order._id,
                itemId: item._id,
                description: `Return Refund: ${order._id} - ${item.productName}`,
            });
            
            await wallet.save();
        }
        
        // Save the updated order
        await order.save();
        
        res.status(200).json({
            success: true,
            message: 'Return request approved successfully.',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Error approving return request:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        console.log(req.params)
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        // Find the specific item in the order
        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }
        
        const item = order.items[itemIndex];
        
        // Check if this item can be cancelled
        if (item.status === 'delivered' || item.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'This item cannot be cancelled' });
        }
        
        // Update the item status
        order.items[itemIndex].status = 'cancelled';
        
        // Check if all items are cancelled to update the overall order status
        const allItemsCancelled = order.items.every(item => item.status === 'cancelled');
        if (allItemsCancelled) {
            order.status = 'cancelled';
        } else {
            order.status = 'partially_cancelled';
        }
        
        await order.save();
        
        // Process refund if payment was made through Razorpay
        if (order.paymentMethod === 'razorpay') {
            const userId = order.user;
            let wallet = await Wallet.findOne({ user: userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    user: userId,
                    balance: 0,
                    transactions: [],
                });
            }
            
            // Calculate refund amount for this specific item
            const refundAmount = item.price * item.quantity;
            
            wallet.balance += refundAmount;
            
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                orderId: order._id,
                itemId: item._id,
                description: `Item Refund: ${order._id} - ${item.productName}`,
            });
            
            await wallet.save();
        }
        console.log(order.status)
        res.status(200).json({
            success: true,
            message: 'Item cancelled successfully',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Error cancelling item:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


module.exports = {
    getOrderList,
    getOrderDetails,
    cancelOrder,
    updateOrderStatus,
    successReturn,
    cancelOrderItem,
    approveItemReturn,
};