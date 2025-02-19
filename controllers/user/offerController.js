// controllers/userController.js
const Offer = require('../../');

const getActiveOffers = async (req, res) => {
    try {
        const currentDate = new Date();
        const activeOffers = await Offer.find({
            status: 'active',
            start_date: { $lte: currentDate },
            end_date: { $gte: currentDate }
        }).populate('categories', 'name').populate('products', 'productName');
        res.json({ success: true, offers: activeOffers });
    } catch (error) {
        console.error('Error fetching active offers:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
   
    getActiveOffers,
};