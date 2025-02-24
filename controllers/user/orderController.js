const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');

// Get Order Details Controller
const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('items.product', 'images');

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
    const user=req.session.user
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

    if (order.paymentMethod === 'razorpay') {
      console.log('Processing wallet refund for Razorpay payment...');
      let wallet = await Wallet.findOne({ user: user });
      if (!wallet) {
          console.log('Creating new wallet for user:', user);
          wallet = new Wallet({
              user: user._id,
              balance: 0,
              transactions: [],
          });
          await wallet.save();
      }
  
      console.log('Current wallet balance:', wallet.balance);
      wallet.balance += order.totalPrice;
  
      wallet.transactions.push({
          amount: order.totalPrice,
          type: 'credit',
          orderId: order._id,
          description: `Order Refund : ${order._id}`,
      });
  
      console.log('Updated wallet balance:', wallet.balance);
      console.log('New transaction added:', wallet.transactions[wallet.transactions.length - 1]);
  
      await wallet.save();
      console.log('Wallet updated successfully.');
  
  }
  
    res.status(200).json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).send('Server Error');
  }
};

// Submit Return Request Controller
const submitReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, details } = req.body;

    // Validate inputs
    const validReasons = ['wrong_size', 'damaged', 'not_as_described', 'changed_mind', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: 'Invalid reason provided.' });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Check if the order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });
    }

    // Update the order with return request details
    order.returnRequest = {
      reason,
      details,
      status: 'pending', // Initial status for return requests
      requestDate: new Date(),
    };

    // Update the order status to "return_requested"
    order.status = 'return_requested';

    // Save the updated order
    await order.save();

    res.status(200).json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting return request:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// Approve Return Request Controller
const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order
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
  getOrderDetails,
  cancelOrder,
  submitReturn,
  approveReturn,
};