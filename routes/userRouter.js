const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const cartController = require("../controllers/user/cartController");
const orderController = require('../controllers/user/orderController');
const passport = require('passport');
const { userAuth } = require('../middlewares/auth');


router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomepage);
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup)
router.get('/shop',userController.loadShoppingPage);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
router.get('/filter',userController.filterProduct);
router.get('/productDetails',productController.productDetails);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/');
});

router.get('/login',userController.loadLogin);
router.post("/login",userController.login);
router.get('/logout',userController.logout);
//profile management
router.get('/forgot-password',profileController.getForgotPassPage);
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp);
router.get('/reset-password',profileController.getResetPassPage);
router.post('/resend-forgot-otp',profileController.resendOtp);
router.post('/reset-password',profileController.postNewPassword);
router.get('/userProfile',userAuth,profileController.userProfile);
//address management
router.get('/addAddress',userAuth,profileController.addAddress);
router.post('/addAddress',userAuth,profileController.postAddAddress);
router.get('/editAddress',userAuth,profileController.editAddress);
router.post('/editAddress',userAuth,profileController.postEditAddress);
router.get('/deleteAddress',userAuth,profileController.deleteAddress);


//cart management
router.post('/add-to-cart',userAuth,cartController.addToCart);
router.get('/cart',userAuth,cartController.getCart);
router.post('/cart-remove',userAuth,cartController.removeCart);
router.get('/checkout',userAuth,cartController.getCheckout);
router.post('/cart-update',userAuth,cartController.updateCart);
router.post('/order-success',userAuth,cartController.getOrderSuccess);


//order management

router.get('/order-details/:orderId',userAuth,orderController.getOrderDetails);
router.get('/checkout-addAddress',userAuth,profileController.checkoutAddAddress);
router.post('/checkout-addAddress',userAuth,profileController.checkoutPostAddAddress);
router.get('/checkout-editAddress',userAuth,profileController.checkoutEditAddress);
router.post('/checkout-editAddress',userAuth,profileController.checkoutPostEditAddress);










module.exports = router;