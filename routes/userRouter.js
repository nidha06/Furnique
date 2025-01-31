const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/user/productController');
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
// router.post('/login', (req, res) => {
//     console.log("submitted data",req.body); // Log submitted data
//     res.send('Login route hit!');
// });

router.get('/logout',userController.logout);




module.exports = router;