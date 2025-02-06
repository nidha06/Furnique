const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');

exports.addToCart = async (req, res) => {
    try {
      const user= req.session.user
      const { productId } = req.body;
  
      if (!user) {
        return res.status(400).json({ error: "User authentication required" });
      }

      const product= await Product.findById(productId)
  
      let cart= await Cart.findOne({user})
      if(!cart){
        cart = new Cart({ user, items: [{product}]})
      }
      cart.items.push({
        product,
        quantity:1,
      });
      
      await cart.save();
  
      res.status(200).json({success:true,cart});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  };

 

exports.getCart = async (req, res) => {
    try {
        const user = req.session.user; // Get logged-in user
        console.log(req.session.user);
        
        if (!user) {
            return res.redirect('/login'); // Redirect to login if not authenticated
        }

        const cart = await Cart.findOne({ user }).populate('items.product') 
        console.log(cart)

        res.render('cart', { cart }); // Render the cart page with cart data
       
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

exports.removeCart = async (req, res) => {
    try {
        const user = req.session.user;
        const { productId } = req.body;

        if (!user) {
            return res.status(400).json({ error: "User authentication required" });
        }

        let cart = await Cart.findOne({ user });
        if (!cart) {
            return res.status(404).json({ error: "Cart not found" });
        }

        // Remove the item from the cart
        cart.items = cart.items.filter(item => item.product.toString() !== productId);

        await cart.save();

        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

exports.getCheckout = async (req, res) => {
  try {
    
    
    const user= req.session.user;

    
    if(!user){
      res.redirect('/login');
    } // Assuming user session is stored
    const address = await Address.findOne({ userId:user }).populate('userId');

    
    res.render('checkout', { address: address ? address.address : [] });

} catch (error) {
    console.log(error);
    res.redirect('/cart');
}
};




exports.updateCart= async (req, res) => {
    const { productId, quantity } = req.body;
    console.log('=======',productId, quantity)

    try {
        // Validate input
        if (!productId || !quantity || isNaN(quantity) || quantity < 1) {
            return res.status(400).json({ success: false, message: 'Invalid product ID or quantity.' });
        }

        // Ensure the user is authenticated
        const userId = req.session.user;
        console.log('--------',userId);
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }

        // Find the user's cart
        const userCart = await Cart.findOne({ user: userId });
        if (!userCart) {
            return res.status(404).json({ success: false, message: 'Cart not found.' });
        }

        // Find the specific item in the cart
        const itemIndex = userCart.items.findIndex(item => item.product.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart.' });
        }

        // Update the quantity
        userCart.items[itemIndex].quantity = parseInt(quantity);

        // Save the updated cart
        await userCart.save();

        // Respond with success
        return res.json({ success: true, message: 'Cart updated successfully.' });
    } catch (error) {
        console.error('Error updating cart:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

