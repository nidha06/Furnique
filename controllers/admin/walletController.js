const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');

const getAllWallets = async (req, res) => {
    try {
        console.log('kelkkunnundo kambilippothapp !!!!');
        
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        const wallets = await Wallet.find({})
            .populate('user', 'name email')
            .select('user balance transactions createdAt updatedAt');
            
        let allTransactions = [];
        wallets.forEach(wallet => {
            if (wallet.transactions) {
                wallet.transactions.forEach(transaction => {
                    allTransactions.push({
                        ...transaction.toObject(),
                        user: wallet.user
                    });
                });
            }
        });
                
        // Sort transactions by createdAt (newest first)
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalTransactions = allTransactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
            
        const paginatedTransactions = allTransactions.slice(skip, skip + limit);
        
        console.log(paginatedTransactions);
          
        res.render('wallet', {
            wallets,
            transactions: paginatedTransactions,
            currentPage: page,
            totalPages,
        });
        
    } catch (error) {
        console.error('Error fetching wallets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get detailed wallet information for a specific user
const getWalletById = async (req, res) => {
    try {
        // Check if admin
        if (!req.session.isAdmin) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }
        
        const { walletId } = req.params;
            
        const wallet = await Wallet.findById(walletId)
            .populate('user', 'name email')
            .populate({
                path: 'transactions.orderId',
                select: '_id totalPrice status'
            });
            
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }
        
        res.json(wallet);
    } catch (error) {
        console.error('Error fetching wallet details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const getTransactionDetail = async (req, res) => {
    try {
      
        
        const { transactionId } = req.params;
        
        
        const wallet = await Wallet.findOne(
            { "transactions._id": transactionId },
            { "transactions.$": 1, balance: 1 }
        ).populate('user', 'name email _id');
        
        if (!wallet || !wallet.transactions || wallet.transactions.length === 0) {
            return res.status(404).render('error', { 
                message: 'Transaction not found',
                error: { status: 404 }
            });
        }
        
        
        const transaction = wallet.transactions[0];
        
        // Add the user details to the transaction
        transaction.user = wallet.user;
        
        // If transaction has an orderId, populate it
        if (transaction.orderId) {
            const Order = require('../../models/orderSchema');
            const order = await Order.findById(transaction.orderId);
            transaction.order = order;
        }
        
        res.render('wallet-detailing', { 
            transaction,
            wallet
        });
        
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).render('error', { 
            message: 'Internal server error',
            error: { status: 500 }
        });
    }
};

module.exports = {
    getWalletById,
    getAllWallets,
    getTransactionDetail
};