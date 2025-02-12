const Order = require('../../models/orderSchema');


const getOrderDetails= async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email').populate('items.product', 'images');

    
      if (!order) {
        return res.status(404).send('Order not found');
      }
      console.log(order);
      res.render('order-details', { order });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  };

  // Cancel Order Controller
  const cancelOrder = async (req, res) => {
    try {
      const { orderId } = req.params;
      
  
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).send('Order not found');
      }
  
      // Check if the order can be cancelled
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return res.status(400).send('Order cannot be cancelled');
      }
  
      // Update order status and add cancellation reason
      order.status = 'cancelled';
     
      await order.save();
  
      res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(500).send('Server Error');
    }
  };
module.exports={
    getOrderDetails,
    cancelOrder,
}