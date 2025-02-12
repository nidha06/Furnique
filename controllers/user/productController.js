const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        const product = await Product.findById(productId).populate('category');
        const findCategory = product.category;
        const cart = await Cart.findOne({ user: userId });

        const similarProducts = await Product.find({
            category: findCategory._id,
            _id: { $ne: productId }
        }).limit(4);

        res.render('product-details', {
            user: userData,
            product: product,
            quantity: product.quantity,
            category: findCategory,
            cart: cart,
            similarProducts: similarProducts
        });

    } catch (error) {
        console.error('error for fetching product details', error);
        res.redirect('/pageNotFound');
    }
}

module.exports = {
    productDetails,
};