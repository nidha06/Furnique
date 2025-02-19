// controllers/offerController.js
const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema'); // Assuming you have a product schema
const Category = require('../../models/categorySchema'); // Assuming you have a category schema

const getOffer = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const offers = await Offer.find()
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);
        const totalOffers = await Offer.countDocuments();
        const totalPages = Math.ceil(totalOffers / limit);
        return res.render('offer', {
            offers,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.error('Error in getOffer:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getcreateOffer = async (req, res) => {
    try {
        // Fetch all categories and products from the database
        const categories = await Category.find({}, { name: 1, _id: 1 }); // Fetch only names and IDs
        const products = await Product.find({}, { productName: 1, _id: 1 }); // Fetch only names and IDs
      
        // Render the 'offer-create' page with categories and products
        return res.render('offer-create', { categories, products });
    } catch (error) {
        console.error('Error in createOffer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const submitOffer = async (req, res) => {

    try {
       
        const {
            title,
            offerType,
            categories,
            discount_type:discountType,
            discount_value:discountValue,
            start_date:startDate,
            end_date:endDate,
            minimum_purchase:minimumPurchase,
 
        } = req.body;
        

        // Validate required fields
        if ( !title || !offerType ||  !discountType || !discountValue || !startDate || !endDate || !minimumPurchase) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        // Create a new offer object
        const newOffer = new Offer({
            title,
            
            categories: offerType === 'categoryBased' ? categories : [],
            products: offerType === 'productBased' ? products : [],
            discount_type: discountType,
            discount_value: discountValue,
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            minimum_purchase: minimumPurchase,
        
            
        });

        // Save the offer to the database
        await newOffer.save();

        // Redirect or respond with success
        return res.status(201).json({ success: true, message: 'Offer created successfully' });
    } catch (error) {
        console.error('Error in submitOffer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const updateOfferStatus = async (req, res) => {
    try {
        const { id } = req.params; // Get the offer ID from the URL
        const { status } = req.body; 
        console.log('request body:',status);// Get the new status from the request body

        // Validate the status
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        // Update the offer's status in the database
        const updatedOffer = await Offer.findByIdAndUpdate(
            id,
            { status },
            { new: true } // Return the updated document
        );

        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        // Respond with success
        return res.status(200).json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error in updateOfferStatus:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getOfferForEdit = async (req, res) => {
    try {
        const offerId = req.params.id;

        // Fetch the offer details and populate categories and products
        const offer = await Offer.findById(offerId)
            .populate('categories', 'name') // Populate only the `name` field of categories
            .populate('products', 'productName'); // Populate only the `productName` field of products

        if (!offer) {
            return res.status(404).send('Offer not found');
        }

        // Fetch all categories and products for dropdowns
        const categories = await Category.find({}, { name: 1, _id: 1 });
        const products = await Product.find({}, { productName: 1, _id: 1 });

        // Render the edit form with the offer data
        return res.render('offer-update', { offer, categories, products });
    } catch (error) {
        console.error('Error in getOfferForEdit:', error);
        res.status(500).send('Internal Server Error');
    }
};


const updateOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const updateData = req.body;

        // Convert categories and products from strings to arrays if needed
        if (updateData.categories && !Array.isArray(updateData.categories)) {
            updateData.categories = updateData.categories.split(',');
        }
        if (updateData.products && !Array.isArray(updateData.products)) {
            updateData.products = updateData.products.split(',');
        }

        // Update the offer in the database
        await Offer.findByIdAndUpdate(offerId, updateData);

        // Redirect to the offer management page
        res.redirect('/admin/offermanagement');
    } catch (error) {
        console.error('Error in updateOffer:', error);
        res.status(500).send('Internal Server Error');
    }
};



module.exports = {
    getOffer,
    getcreateOffer,
    submitOffer,
    updateOfferStatus,
    getOfferForEdit,
    updateOffer,
};