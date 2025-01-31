const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const { log } = require('console');

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render('product-add', {
            cat: category,
        });
    } catch (error) {
        console.error('Error fetching category:', error); // Debug log
        res.redirect('pageerror');
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        // Check if product exists
        const productExists = await Product.findOne({ productName: products.productName });

        if (productExists) {
            // Deleting files if they exist
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

        // Process images (uploaded and cropped images)
        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                images.push(file.filename);
            }
        }

        // If there are cropped images, add them to the images array
        if (req.body.croppedImages && req.body.croppedImages.length > 0) {
            for (let i = 0; i < req.body.croppedImages.length; i++) {
                images.push(req.body.croppedImages[i]); // Add cropped images
            }
        }

        // Validate category
        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
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

        // Create the new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            quantity: products.quantity,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            category: categoryId._id,
            images: images,
        });

        // Save the product
        await newProduct.save();

        res.status(200).json({
            success: true,
            message: 'Product added successfully!',
        }); 
    } catch (error) {
        console.error('Error saving the product:', error); // Debug log for errors
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

        // Fetching paginated product data
        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } }, // Search by product name
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
                    // Add a full URL for each image in the product
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


const getListProduct = async(req,res)=>{
    try {

        let id = req.query.id;
        console.log("Product ID:", id);

        const result = await Product.updateOne({_id:id},{$set:{isListed:true}});
        console.log("Update Result:", result);
        res.redirect('/admin/products');
        
    } catch (error) {
        res.redirect('/pageerror');
    }
}


const getUnlistProduct = async(req,res)=>{
    try {
        let id = req.query.id;
        const result=await Product.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect('/admin/products');
    } catch (error) {
        res.redirect('/pageerror');
    }
}


const getEditProduct = async (req, res) => {
    try {
      const id = req.query.id;
      const product = await Product.findOne({ _id: id });
      const categories = await Category.find({}); // Fetch all categories
  
      console.log(product);
      res.render('edit-product', {
        product: product,     // Pass the product to the view
        categories: categories // Pass all categories to the view
      });
    } catch (error) {
      console.error(error); // Log error for debugging
      res.redirect('/pageerror'); // Redirect to an error page
    }
  };


const editProduct= async (req, res) => {
    try {
      const id = req.params.id;
      const product = await Product.findOne({ _id: id });
      const data = req.body;

      console.log(data);
      
  
      // Check if a product with the same name already exists
      const existingProduct = await Product.findOne({
        productName: data.productName,
        _id: { $ne: id }
      });
  
      if (existingProduct) {
        return res.status(400).json({ error: 'Product with this name already exists. Please try with another name.' });
      }
  
      // Handle image updates
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          // Extract the index from the fieldname (e.g., "images[0]" => 0)
          const index = file.fieldname.match(/\[(\d+)\]/)[1];
          product.images[index] = file.filename; // Replace the image at the specified index
        });
      }

      const categoryId = await Category.findOne({name:data.category});

      if(!categoryId) {
        console.log('category not found');
        return res.status(404).json({ error: 'category not found' });
      }
  
      // Update fields
      const updateFields = {
        productName: data.productName,
        description: data.description,
        category: categoryId,
        regularPrice: data.regularPrice,
        salePrice: data.salePrice,
        quantity: data.quantity,
        images: product.images, // Update the images array
      };
  
      // Update the product in the database
      await Product.findByIdAndUpdate(id, updateFields, { new: true });
      res.redirect('/admin/products');
  
    } catch (error) {
      console.error(error);
      res.redirect('/pageerror');
    }
}


const deleteSingleImage = async(req,res)=>{
    try {
        const {imageNameToServer,productIdToServer}=req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
        const imagePath = path.join('public','upload','re-image',imageNameToServer);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`image ${imageNameToServer} deleted successfully`)
        }
        else{
            console.log(`image ${imageNameToServer }not found `)
        }
        res.send({status:true});
    } catch (error) {
        res.redirect('/pageerror');
    }
}
  



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
