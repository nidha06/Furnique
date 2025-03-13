const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const cartController = require("../controllers/user/cartController");
const orderController = require('../controllers/user/orderController');
const paymentController = require('../controllers/user/paymentController');
const walletController = require('../controllers/user/walletController');


const passport = require('passport');
const { userAuth } = require('../middlewares/auth');

router.get('/is-logged-in',userController.isUser);
router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomepage);
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup)
router.post('/change-password',userAuth,userController.changePassword);
router.get('/shop',userController.loadShoppingPage);
router.get('/get-aboutUs',userController.getAboutUs);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
router.get('/filter',userController.filterProduct);
router.get('/productDetails',productController.productDetails);
router.post('/add-wishlist',userAuth,productController.wishlistAdd);
router.get('/get-wishlist-status',userAuth,productController.getWishlist);
router.get('/wishlist', userAuth,productController.getListWishlist);
router.post('/wishlist-toggle/:productId',userAuth,productController.toggleWishlistItem);
router.post('/wishlist-remove/:productId', userAuth,productController.removeFromWishlist);
router.get('/wishlist-count',userAuth,productController.getWishlistCount);



router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),
userController.googleSignin
);

router.get('/login',userController.loadLogin);
router.post("/login",userController.login);
router.get('/logout',userController.logout);
router.get('/get-contactUs',userController.getContactUs);
//profile management
router.get('/forgot-password',profileController.getForgotPassPage);
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.post('/check-email',profileController.checkEmail)
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
router.post('/cart-update',userAuth,cartController.updateCart);

router.get('/checkout-addAddress',userAuth,profileController.checkoutAddAddress);
router.post('/checkout-addAddress',userAuth,profileController.checkoutPostAddAddress);
router.get('/checkout-editAddress',userAuth,profileController.checkoutEditAddress);
router.post('/checkout-editAddress',userAuth,profileController.checkoutPostEditAddress);


//order management 
router.get('/order-details/:orderId',userAuth,orderController.getOrderDetails);
router.get('/invoice/:orderId',userAuth,orderController.viewInvoice);
router.get('/invoice/:orderId/download', orderController.downloadInvoice);
router.post('/cancel/:orderId',userAuth,orderController.cancelOrder);
router.post('/cancel-item/:orderId/:itemId', userAuth, orderController.cancelOrderItem);
router.post('/submit-item-return/:orderId/:itemId', userAuth, orderController.submitItemReturn);

router.post('/submit-entire-order-return/:orderId', userAuth,orderController.submitEntireOrderReturn);


//payment management
router.get('/checkout',userAuth,paymentController.getCheckout);
router.post('/wallet-payment', userAuth,paymentController.processWalletPayment);
router.post('/order-success',userAuth,paymentController.getOrderSuccess);
// razorpay
router.post('/create-razorpay-order',userAuth,paymentController.createRazorpayOrder);
router.post('/handle-payment-failure', userAuth,paymentController.handlePaymentFailure);
router.post('/verify-payment',userAuth,paymentController.verifyPayment);
//couponmanagement
router.post('/apply-coupon',userAuth,cartController.applyCoupon);
router.post('/apply-coupon',userAuth,cartController.getActiveCoupons);
//wallet Management
router.get('/getWallet',userAuth,profileController.getWalletDetails);
router.get('/getWallet',userAuth,profileController.initializeWallet);




module.exports = router;