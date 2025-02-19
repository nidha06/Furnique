const Coupon = require('../../models/couponSchema');

// Get all coupons with pagination and search
const getCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const search = req.query.search || '';

        const query = search
            ? { code: { $regex: search, $options: 'i' } }
            : {};

        const totalCoupons = await Coupon.countDocuments(query);
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('coupon', {
            coupons,
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Error fetching coupons');
    }
};

const getCreateCoupon = async(req,res)=>{
    try {
        return res.render('coupon-create');
    } catch (error) {
       console.log(error); 
    }
}

// Create new coupon
const createCoupon = async (req, res) => {
    try {
        const {
            code,
            discountType,
            discountAmount,
            minPurchase,
            expiryDate
        } = req.body;

        // Validate discount amount
        if (discountType === 'percentage' && discountAmount > 100) {
            return res.status(400).send('Percentage discount cannot exceed 100%');
        }

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discountType,
            discountAmount,
            minPurchase,
            expiryDate
        });

        await newCoupon.save();
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).send('Error creating coupon');
    }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        await Coupon.findByIdAndDelete(id);
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).send('Error deleting coupon');
    }
};

// Edit coupon page
const editCouponPage = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        res.render('coupon-update', { coupon });
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.status(500).send('Error fetching coupon');
    }
};

// Update coupon
const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            discountType,
            discountAmount,
            minPurchase,
            expiryDate
        } = req.body;

        if (discountType === 'percentage' && discountAmount > 100) {
            return res.status(400).send('Percentage discount cannot exceed 100%');
        }

        await Coupon.findByIdAndUpdate(id, {
            code: code.toUpperCase(),
            discountType,
            discountAmount,
            minPurchase,
            expiryDate
        });

        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).send('Error updating coupon');
    }
};

// Validate coupon (for use in checkout)
const validateCoupon = async (code, totalAmount) => {
    try {
        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true,
            expiryDate: { $gt: new Date() }
        });

        if (!coupon) {
            return { valid: false, message: 'Invalid or expired coupon' };
        }

        if (totalAmount < coupon.minPurchase) {
            return {
                valid: false,
                message: `Minimum purchase amount of ₹${coupon.minPurchase} required`
            };
        }

        const discountAmount = coupon.discountType === 'percentage'
            ? (totalAmount * coupon.discountAmount) / 100
            : coupon.discountAmount;

        return {
            valid: true,
            discount: discountAmount,
            coupon: coupon
        };
    } catch (error) {
        console.error('Error validating coupon:', error);
        return { valid: false, message: 'Error validating coupon' };
    }
};

// Update coupon status (Activate/Deactivate)
const updateCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        // Update the coupon's isActive status
        await Coupon.findByIdAndUpdate(id, { isActive });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating coupon status:', error);
        res.status(500).json({ success: false, message: 'Error updating coupon status' });
    }
};

module.exports = {
    getCoupons,
    getCreateCoupon,
    createCoupon,
    deleteCoupon,
    editCouponPage,
    updateCoupon,
    validateCoupon,
    updateCouponStatus,
};

