const express = require('express');
const router = express.Router();
const adminController= require('../controllers/admin/adminController');
const customerContoller = require('../controllers/admin/customerController');
const categoryController=require('../controllers/admin/categoryController');
const productController=require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const offerController = require('../controllers/admin/offerController');
const couponController = require('../controllers/admin/couponController');
const dashboardController = require('../controllers/admin/dashboardController');
const walletController = require('../controllers/admin/walletController');
const upload = require('../middlewares/multerConfig');
const {adminAuth}=require("../middlewares/auth");


router.get('/pageerror',adminController.pageerror);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);

router.get("/logout",adminController.logout);
//customer management
router.get("/users",adminAuth,customerContoller.customerInfo);
router.get('/blockCustomer',adminAuth,customerContoller.customerBlocked);
router.get('/unblockCustomer',adminAuth,customerContoller.customerunBlocked);
//category management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory);
router.post('/listCategory',adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get('/editCategory',adminAuth,categoryController.getEditCategory);
router.post('/editCategory/:id',adminAuth,categoryController.editCategory);
//product management
router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post('/addProducts', adminAuth,upload, productController.addProducts);
router.get('/products',adminAuth,productController.getAllProducts);
router.get('/listProduct',adminAuth,productController.getListProduct);
router.get("/unlistProduct",adminAuth,productController.getUnlistProduct);
router.get('/editProduct',adminAuth,productController.getEditProduct);
router.post('/editProduct/:id',adminAuth,upload,productController.editProduct);
router.post('/deleteImage',adminAuth,productController.deleteSingleImage);
//order management
router.get('/orders',adminAuth,orderController.getOrderList);
router.get('/order-details/:orderId',adminAuth,orderController.getOrderDetails);
router.put('/orders/:orderId/cancel',adminAuth,orderController.cancelOrder);
router.put('/orders/:orderId/update-status',adminAuth,orderController.updateOrderStatus);
router.put('/orders/:orderId/approve-return',adminAuth,orderController.successReturn);
router.put('/orders/:orderId/items/:itemId/approve-return', adminAuth, orderController.approveItemReturn);
router.put('/orders/:orderId/items/:itemId/cancel', adminAuth, orderController.cancelOrderItem);
//offer management
router.get('/offermanagement',adminAuth,offerController.getOffer);
router.get('/get-create-offer',adminAuth,offerController.getcreateOffer);
router.post('/submit-offer',adminAuth,offerController.submitOffer);
router.patch('/update-offer-status/:id', offerController.updateOfferStatus);
router.get('/edit-offer/:id', adminAuth, offerController.getOfferForEdit);
router.post('/update-offer/:id', adminAuth, offerController.updateOffer);
//coupon management
router.get('/coupons',adminAuth,couponController.getCoupons);
router.get('/getCreateCoupon',adminAuth,couponController.getCreateCoupon);
router.post('/createCoupon',adminAuth,couponController.createCoupon);
router.get('/deleteCoupon/:id',adminAuth,couponController.deleteCoupon);
router.get('/editCoupon/:id',adminAuth,couponController.editCouponPage);
router.post('/updateCoupon/:id',adminAuth,couponController.updateCoupon);
router.post('/update-coupon-status/:id', adminAuth, couponController.updateCouponStatus);
//dashboard management
router.get('/reports-sales/export', adminAuth, dashboardController.generateSalesReport);
router.get('/reports-sales', adminAuth,dashboardController.getReport);
router.get('/dashboard',adminAuth, dashboardController.getDashboard);
router.get('/dashboard/sales-data',adminAuth, dashboardController.getSalesDataByPeriod);
//wallet management
router.get('/wallets',adminAuth,walletController.getAllWallets);
router.get('/wallets/:walletId',adminAuth,walletController.getWalletById);
router.get('/wallet/transaction/:transactionId', adminAuth,walletController.getTransactionDetail);



module.exports = router;