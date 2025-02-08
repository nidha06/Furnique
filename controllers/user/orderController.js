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


module.exports={
    getOrderDetails,
}