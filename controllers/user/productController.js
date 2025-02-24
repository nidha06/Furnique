const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Offer = require('../../models/offerSchema');
const Wishlist = require('../../models/wishlistSchema');


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

        
        const catOffer= await Offer.findOne({category:product.category._id})

        const productDiscount = product.regularPrice > 0 ? 
        Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100) : 0;
        
        const bestDiscount= Math.max(productDiscount,catOffer.discount_value);
      
          if(bestDiscount>productDiscount){
            console.log(Math.floor(product.regularPrice *(1-bestDiscount/100)))
            product.productOffer=bestDiscount;
            product.salePrice=Math.floor(product.regularPrice *(1-bestDiscount/100))

          }
     
        res.render('product-details', {
            user: userData,
            product: product,
            quantity: product.quantity,
            category: findCategory,
            cart: cart,
            similarProducts: similarProducts,
        });

    } catch (error) {
        console.error('error for fetching product details', error);
        res.redirect('/pageNotFound');
    }
}




const wishlistAdd = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;

        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        
        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: []
            });
        }

        
        const productIndex = wishlist.products.indexOf(productId);
        let added = false;

        if (productIndex === -1) {
            
            wishlist.products.push(productId);
            added = true;
        } else {
            
            wishlist.products.splice(productIndex, 1);
        }

        await wishlist.save();

        return res.status(200).json({
            success: true,
            added,
            message: added ? 'Item added to wishlist' : 'Item removed from wishlist'
        });
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
  
  
  const getWishlist = async (req, res) => {
    try {
      const userId = req.session.user;
      const user = await User.findById(userId).select('wishlist');
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      return res.status(200).json({
        success: true,
        wishlistItems: user.wishlist || []
      });
    } catch (error) {
      console.error('Get wishlist status error:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };


  const getListWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ user: userId })
            .populate('products');

        res.render('wishlist', {
            wishlist: wishlist || { products: [] },
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).render('error', { message: 'Error fetching wishlist' });
    }
};
  
  const toggleWishlistItem = async (req, res) => {
    try {
      const productId = req.params.productId;
      
      
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      
      
      let wishlist = await Wishlist.findOne({ user: req.session.user });
      
      
      if (!wishlist) {
        wishlist = await Wishlist.create({
          user: req.session.user,
          products: [productId]
        });
        return res.json({ success: true, message: 'Product added to wishlist', added: true });
      }
      
      // Check if product is already in wishlist
      const productIndex = wishlist.products.indexOf(productId);
      
      if (productIndex === -1) {
        // Add to wishlist
        wishlist.products.push(productId);
        await wishlist.save();
        return res.json({ success: true, message: 'Product added to wishlist', added: true });
      } else {
        // Remove from wishlist
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();
        return res.json({ success: true, message: 'Product removed from wishlist', added: false });
      }
    } catch (error) {
      console.error('Error toggling wishlist item:', error);
      res.status(500).json({ success: false, message: 'Error updating wishlist' });
    }
  };
  
const removeFromWishlist = async (req, res) => {
    try {
      const productId = req.params.productId;
      
      
      const wishlist = await Wishlist.findOne({ user: req.session.user });
      
      if (!wishlist) {
        return res.status(404).json({ success: false, message: 'Wishlist not found' });
      }
      
      // Remove product from wishlist
      const productIndex = wishlist.products.indexOf(productId);
      if (productIndex !== -1) {
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();
        return res.json({ success: true, message: 'Product removed from wishlist' });
      } else {
        return res.json({ success: false, message: 'Product not in wishlist' });
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      res.status(500).json({ success: false, message: 'Error removing product from wishlist' });
    }
  };
  
  
    const getWishlistCount = async (req, res) => {
        try {
            const wishlist = await Wishlist.findOne({ user: req.session.user });
            const count = wishlist ? wishlist.products.length : 0;
            res.json({ success: true, count });
        } catch (error) {
            console.error('Error getting wishlist count:', error);
            res.status(500).json({ success: false, message: 'Error fetching wishlist count' });
        }
    };

module.exports = {
    productDetails,
    wishlistAdd,
    getWishlist,
    getListWishlist,
    toggleWishlistItem,
    removeFromWishlist,
    getWishlistCount, 
};
