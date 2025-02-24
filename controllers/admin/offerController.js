// controllers/offerController.js
const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema'); // Assuming you have a product schema
const Category = require('../../models/categorySchema'); // Assuming you have a category schema
const mongoose = require("mongoose");
const getOffer = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const offers = await Offer.find()
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit).populate('category', 'name');
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
            category,
            discount_type,
            discount_value,
            start_date,
            end_date,
            minimum_purchase,
 
        } = req.body;
        console.log(req.body);
        
        

        // Validate required fields
        if ( !title ||  !discount_type || !discount_value || !start_date || !end_date || !minimum_purchase) {
           console.log('jfnifhjnfifhnv');
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        // Create a new offer object
        const newOffer = new Offer({
            title,
            
            category,
            discount_type,
            discount_value,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            minimum_purchase, 
            
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
            { categories: req.body.categories }, // Single value, not an array
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

        // Fetch the offer details and populate the category name
        const offer = await Offer.findById(offerId).populate('category', 'name'); // Populate only the `name` field of the category
   
        if (!offer) {
            return res.status(404).send('Offer not found');
        }

        // Fetch all categories for the dropdown
        const categories = await Category.find({}, { name: 1, _id: 1 });
       console.log(offer);
       
        // Render the edit form with the offer data and categories
        return res.render('offer-update', { offer, categories });
    } catch (error) {
        console.error('Error in getOfferForEdit:', error);
        res.status(500).send('Internal Server Error');
    }
};


const updateOffer = async (req, res) => {
    try {
        const offerId = req.params.id; // Extract the offer ID from the URL
        const { title, discount_type, discount_value, start_date, end_date, minimum_purchase, category } = req.body;

        console.log(req.body)
        // Validate the offer ID
        if (!mongoose.Types.ObjectId.isValid(offerId)) {
            return res.status(400).json({ success: false, message: 'Invalid offer ID' });
        }

        // Validate the category ID
        if (!mongoose.Types.ObjectId.isValid(category)) {
            return res.status(400).json({ success: false, message: 'Invalid category ID' });
        }

        // Update the offer in the database
        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                title,
                discount_type,
                discount_value,
                start_date,
                end_date,
                minimum_purchase,
                category,
            },
            { new: true } // Return the updated document
        );

        // Check if the offer exists
        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        // Redirect to the offer management page or send a success response
        return res.status(200).json({success: true, message: 'edited successfully'})
    } catch (error) {
        console.error('Error in updateOffer:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
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