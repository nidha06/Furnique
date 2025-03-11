const { session } = require('passport');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');

const getOrderList = async (req, res) => {
    try {
        const orders = await Order.find().sort({createdAt:-1})
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt returnRequest');
        if (!orders || orders.length === 0) {
            return res.json({ success: false, message: "No orders found." });
        }
        let search = req.query.search || ""; 
        let page = parseInt(req.query.page) || 1;
        const limit = 4;
        const orderData = await Order.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();
        const count = await Order.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        }).countDocuments();
        const totalPages = Math.ceil(count / limit); 


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

        res.render('orders', { orders: simplifiedOrders , totalPages });
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

            let discountAmount=0;
            if(order.appliedCoupon){
                discountAmount = order.appliedCoupon.discountAmount 
            }

            // Calculate refund amount for this specific item
            const refundAmount = item.price * item.quantity - discountAmount ;
            wallet.balance += refundAmount
        
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
  
      
      if (!order.returnRequest || order.returnRequest.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'No pending return request for this order.' });
      }
  
     
      order.returnRequest.status = 'approved';
      order.returnRequest.approvalDate = new Date();
  
      
      order.status = 'returned';
  
      
      await order.save();
  
      res.status(200).json({ success: true, message: 'Return request approved successfully.' });
    } catch (error) {
      console.error('Error approving return request:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  };

  const approveItemReturn = async (req, res) => {
    try {
        console.log('params,,,,,,,',req.params);
        
        const { orderId, itemId } = req.params;
        
        
        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        
        
        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }
        
        const item = order.items[itemIndex];
        
        
        if (item.status !== 'return_requested') {
            return res.status(400).json({ success: false, message: 'No pending return request for this item.' });
        }
                
        
        order.items[itemIndex].status = 'returned';
        
        
        if (order.items.every(item => item.status === 'returned')) {
            order.status = 'returned';
        } else {
            order.status = 'partially_returned';
        }
        
        
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
            
           
            const itemTotalPrice = item.price * item.quantity;

            
            const orderTotalPrice = order.items.reduce((total, currentItem) => total + (currentItem.price * currentItem.quantity), 0);
            const discountAmount = order.appliedCoupon?.discountAmount || 0;
            const proportionalDiscount = (itemTotalPrice / orderTotalPrice) * discountAmount;

           
            const refundAmount = Math.round(itemTotalPrice - proportionalDiscount);
            
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
        
        
        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }
        
        const item = order.items[itemIndex];
        
        
        if (item.status === 'delivered' || item.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'This item cannot be cancelled' });
        }
        
        
        order.items[itemIndex].status = 'cancelled';
        
       
        const allItemsCancelled = order.items.every(item => item.status === 'cancelled');
        if (allItemsCancelled) {
            order.status = 'cancelled';
        } else {
            order.status = 'partially_cancelled';
        }
        
        await order.save();
        
        
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
            
            
            const itemTotalPrice = item.price * item.quantity;

            
            const orderTotalPrice = order.items.reduce((total, currentItem) => total + (currentItem.price * currentItem.quantity), 0);
            const discountAmount = order.appliedCoupon?.discountAmount || 0;
            const proportionalDiscount = (itemTotalPrice / orderTotalPrice) * discountAmount;

            
            const refundAmount = Math.round(itemTotalPrice - proportionalDiscount);
            
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