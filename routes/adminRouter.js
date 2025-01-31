const express = require('express');
const router = express.Router();
const adminController= require('../controllers/admin/adminController');
const customerContoller = require('../controllers/admin/customerController');
const categoryController=require('../controllers/admin/categoryController');
const productController=require('../controllers/admin/productController');
const upload = require('../middlewares/multerConfig');
const {userAuth,adminAuth}=require("../middlewares/auth");


router.get('/pageerror',adminController.pageerror);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/dashboard',adminAuth,adminController.loadDashboard);
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
router.post('/addProducts', upload, productController.addProducts);
router.get('/products',adminAuth,productController.getAllProducts);
router.get('/listProduct',adminAuth,productController.getListProduct);
router.get("/unlistProduct",adminAuth,productController.getUnlistProduct);
router.get('/editProduct',adminAuth,productController.getEditProduct);
router.post('/editProduct/:id',adminAuth,upload,productController.editProduct);
router.post('/deleteImage',adminAuth,productController.deleteSingleImage);




module.exports = router;