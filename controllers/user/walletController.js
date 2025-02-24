const Wallet = require('../../models/walletSchema');
const Order = require('../../models/orderSchema');

const walletController = {
  // Initialize wallet for new user
  async initializeWallet(userId) {
    try {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        return await Wallet.create({ user: userId });
      }
      return wallet;
    } catch (error) {
      console.error('Error initializing wallet:', error);
      throw error;
    }
  },

  // Get wallet details
  async getWalletDetails(req, res) {
    try {
      const userId = req.session.user;
      let wallet = await Wallet.findOne({ user: userId })
        .populate({
          path: 'transactions.orderId',
          select: '_id totalPrice status'
        });

      if (!wallet) {
        wallet = await walletController.initializeWallet(userId);
      }

      res.json({
        balance: wallet.balance,
        transactions: wallet.transactions
      });
    } catch (error) {
      console.error('Error getting wallet details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Add refund to wallet for cancelled order
  async processOrderRefund(userId, orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order || order.paymentMethod !== 'razorpay') {
        return false;
      }

      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = await walletController.initializeWallet(userId);
      }

      const refundAmount = order.totalPrice;
      
      wallet.balance += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        orderId: order._id,
        description: `Refund for order #${order._id}`
      });

      await wallet.save();
      return true;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }
};

module.exports = walletController;

