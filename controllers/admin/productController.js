const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render('product-add', { cat: category });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.redirect('pageerror');
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        
        // Check if product already exists
        const productExists = await Product.findOne({ 
            productName: { $regex: new RegExp(`^${products.productName}$`, 'i') } 
        });
        
        if (productExists) {
            // Delete any uploaded files if product exists
            if (req.files) {
                for (const file of req.files) {
                    await fs.promises.unlink(path.join('public', 'uploads', file.filename))
                        .catch(err => console.error('Error deleting file:', err));
                }
            }
            return res.status(400).json({
                success: false,
                message: 'Product already exists, please try with another name'
            });
        }

        // Handle images
        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Assuming multer is configured to save files and provide filename
                images.push(file.filename);
            }
        }

        // Get category
        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            // Delete uploaded files if category is invalid
            if (req.files) {
                for (const file of req.files) {
                    await fs.promises.unlink(path.join('public', 'uploads', file.filename))
                        .catch(err => console.error('Error deleting file:', err));
                }
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid category'
            });
        }

        // Create and save new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            quantity: parseInt(products.quantity),
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
            category: categoryId._id,
            images: images,
        });

        await newProduct.save();

        res.status(200).json({
            success: true,
            message: 'Product added successfully!',
        });
    } catch (error) {
        console.error('Error saving the product:', error);
        // Delete uploaded files if there's an error
        if (req.files) {
            for (const file of req.files) {
                await fs.promises.unlink(path.join('public', 'uploads', file.filename))
                    .catch(err => console.error('Error deleting file:', err));
            }
        }
        res.status(500).json({
            success: false,
            message: 'Error saving the product',
        });
    }
};

const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = req.query.page || 1;
        const limit = 4;
        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .exec();
        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
            ],
        }).countDocuments();
        const category = await Category.find({ isListed: true });
        if (category.length > 0) {
            res.render('products', {
                products: productData.map(product => {
                    product.images = product.images.map(image => `/uploads/${image}`);
                    return product;
                }),
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
            });
        } else {
            res.render('page-404');
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        res.redirect('/pageerror');
    }
};

const getListProduct = async (req, res) => {
    try {
        let id = req.query.id;
        const result = await Product.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect('/admin/products');
    } catch (error) {
        res.redirect('/pageerror');
    }
};

const getUnlistProduct = async (req, res) => {
    try {
        let id = req.query.id;
        const result = await Product.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect('/admin/products');
    } catch (error) {
        res.redirect('/pageerror');
    }
};

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id });
        const categories = await Category.find({});
        res.render('edit-product', {
            product: product,
            categories: categories
        });
    } catch (error) {
        console.error(error);
        res.redirect('/pageerror');
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;
        const existingProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${data.productName}$`, "i") },
            _id: { $ne: id }
        });
        if (existingProduct) {
            return res.status(400).json({ error: 'Product with this name already exists. Please try with another name.' });
        }
        const regularPrice = parseFloat(data.regularPrice);
        const salePrice = parseFloat(data.salePrice);
        if (salePrice > regularPrice) {
            return res.status(400).json({ error: 'Sale price cannot be higher than the regular price.' });
        }
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const index = file.fieldname.match(/\[(\d+)\]/)[1];
                product.images[index] = file.filename;
            });
        }
        const categoryId = await Category.findById(data.category);
        if (!categoryId) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const updateFields = {
            productName: data.productName.trim(),
            description: data.description.trim(),
            category: categoryId,
            regularPrice: regularPrice,
            salePrice: salePrice,
            quantity: data.quantity,
            images: product.images,
        };
        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect('/admin/products');
    } catch (error) {
        console.error(error);
        res.redirect('/pageerror');
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImage: imageNameToServer } });
        const imagePath = path.join('public', 'upload', 're-image', imageNameToServer);
        if (fs.existsSync(imagePath)) {
            await fs.unlinkSync(imagePath);
        }
        res.send({ status: true });
    } catch (error) {
        res.redirect('/pageerror');
    }
};

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    getListProduct,
    getUnlistProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
};