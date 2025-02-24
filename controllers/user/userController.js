const User = require("../../models/userSchema");
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Whishlist = require('../../models/wishlistSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");
const otpGenerator = require('otp-generator');
const Offer = require('../../models/offerSchema');

// Load Signup Page
const loadSignup = async (req, res) => {
    try {
        res.render('signup');
    } catch (error) {
        console.log('home page load failed');
        res.status(500).send('internal server error');
    }
};

// Send Verification Email
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'verify your account',
            text: `Your OTP is ${otp}`,
            html: ` Your OTP: ${otp} `,
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending email...', error.message, error.stack);
        return false;
    }
}

// Generate OTP
function generateOtp() {
    const otp = otpGenerator.generate(6, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
    });
    return otp;
}

// Handle Signup
const signup = async (req, res) => {
    try {
        const { name, email, password, cpassword } = req.body;

        if (password !== cpassword) {
            return res.render("signup", { message: "password do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: 'user already exist in this mail id' });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json('email.error');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        req.session.userOtp = otp;
        req.session.userData = { name, email, hashedPassword };

        res.render('verify-otp');
    } catch (error) {
        console.log('signup error', error);
        res.redirect('/pageNotFound');
    }
};

// Load Shopping Page
const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        console.log('querr indooo',req.query)
        const sortType = req.query.sort || 'new-arrival';
        const priceRanges = req.query.priceRanges;
        const searchQuery = req.query.query || '';
        const categoryFilter= req.query.category || '';

        console.log(categoryFilter)
        let query = {
            isListed: true,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        };

        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

        if(categoryFilter){
            query.category=categoryFilter
        }

        if (priceRanges) {
            const ranges = priceRanges.split(',').map(range => {
                const [min, max] = range.split('-').map(Number);
                return {
                    salePrice: {
                        $gte: min,
                        $lte: max === 999999 ? Number.MAX_SAFE_INTEGER : max,
                    },
                };
            });
            if (ranges.length > 0) {
                query.$or = ranges;
            }
        }

        let sortOptions = {};
        let collation = null;
        switch (sortType) {
            case 'new-arrival':
                sortOptions = { createdOn: -1 };
                break;
            case 'a-to-z':
                sortOptions = { productName: 1 };
                collation = { locale: 'en', strength: 2 };
                break;
            case 'z-to-a':
                sortOptions = { productName: -1 };
                collation = { locale: 'en', strength: 2 };
                break;
            case 'high-to-low':
                sortOptions = { salePrice: -1 };
                break;
            case 'low-to-high':
                sortOptions = { salePrice: 1 };
                break;
            default:
                sortOptions = { createdOn: -1 };
        }

        let productsQuery = Product.find(query)
            .populate('category')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        if (collation) {
            productsQuery = productsQuery.collation(collation);
        }

        const currentDate = new Date();
        const categoryOffers = await Offer.find({
            status: 'active',
            start_date: { $lte: currentDate },
            end_date: { $gte: currentDate },
        });

        let products = await productsQuery;
        products = products.map(product => {
            const productDiscount = product.regularPrice > 0 ?
                Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100) : 0;

            let bestPrice = product.salePrice;
            let bestDiscount = productDiscount;
            let offerType = 'product';
            let offerTitle = `${productDiscount}% OFF`;

            categoryOffers.forEach(offer => {
                if (offer.category.toString() === product.category._id.toString() &&
                    product.regularPrice >= offer.minimum_purchase) {

                    const categoryDiscountPrice = offer.discount_type === 'percentage' ?
                        product.regularPrice * (1 - offer.discount_value / 100) :
                        product.regularPrice - offer.discount_value;

                    const categoryDiscount = Math.round(((product.regularPrice - categoryDiscountPrice) / product.regularPrice) * 100);

                    if (categoryDiscountPrice < bestPrice) {
                        bestPrice = categoryDiscountPrice;
                        bestDiscount = categoryDiscount;
                        offerType = 'category';
                        offerTitle = offer.title;
                    }
                }
            });

            return {
                ...product.toObject(),
                bestPrice: Math.round(bestPrice),
                discountPercentage: bestDiscount,
                offerType,
                offerTitle,
                hasOffer: bestDiscount > 0,
            };
        });

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        if (user) {
            const cart = await Cart.findOne({ user }).populate('items.product');
            const userWhishlist = await Whishlist.findOne({ user });
            const whishlistProductIds = new Set(
                userWhishlist?.products.map(product => product.toString()) || []
            );

            res.render('shop', {
                user: userData,
                products,
                category: categories,
                totalProducts,
                currentPage: page,
                totalPages,
                cart,
                selectedSort: sortType,
                selectedPriceRanges: priceRanges ? priceRanges.split(',') : [],
                searchQuery,
                categoryOffers,
                userWhishlist: Array.from(whishlistProductIds),
            });
        } else {
            res.render('shop', {
                user: null,
                products,
                category: categories,
                totalProducts,
                currentPage: page,
                totalPages,
                cart: null,
                selectedSort: sortType,
                selectedPriceRanges: priceRanges ? priceRanges.split(',') : [],
                searchQuery,
                categoryOffers,
                userWhishlist: [],
            });
        }
    } catch (error) {
        console.log('Error loading shopping page:', error);
        res.status(500).send('Internal server error');
    }
};

// Filter Products
const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const sortType = req.query.sort || 'new-arrival';
        const priceRanges = req.query.priceRanges;

        console.log(query)

        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        let query = {
            isListed: true,
            quantity: { $gt: 0 },
        };

        if (findCategory) {
            query.category = findCategory._id;
        }

        if (priceRanges) {
            const ranges = priceRanges.split(',').map(range => {
                const [min, max] = range.split('-').map(Number);
                return {
                    salePrice: {
                        $gte: min,
                        ...(max !== Infinity && { $lte: max }),
                    },
                };
            });
            if (ranges.length > 0) {
                query.$or = ranges;
            }
        }

        let sortOptions = {};
        let collation = null;
        switch (sortType) {
            case 'new-arrival':
                sortOptions = { createdOn: -1 };
                break;
            case 'a-to-z':
                sortOptions = { productName: 1 };
                collation = { locale: 'en', strength: 2 };
                break;
            case 'z-to-a':
                sortOptions = { productName: -1 };
                collation = { locale: 'en', strength: 2 };
                break;
            case 'high-to-low':
                sortOptions = { salePrice: -1 };
                break;
            case 'low-to-high':
                sortOptions = { salePrice: 1 };
                break;
            default:
                sortOptions = { createdOn: -1 };
        }

        let productsQuery = Product.find(query).sort(sortOptions);
        if (collation) {
            productsQuery = productsQuery.collation(collation);
        }

        const findProducts = await productsQuery.lean();
        const categories = await Category.find({ isListed: true });

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
        }

        res.render('shop', {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedSort: sortType,
            selectedPriceRanges: priceRanges ? priceRanges.split(',') : [],
        });
    } catch (error) {
        console.error('Error in filterProduct:', error);
        res.redirect('/pageNotFound');
    }
};

// Page Not Found
const pageNotFound = async (req, res) => {
    try {
        res.render('page-404');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

// Load Homepage
const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });

        let products = await Product.find({
            isListed: true,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 },
        });

        products.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        products = products.slice(0, 6);

        if (user) {
            const userData = await User.findOne({ _id: user._id });
            res.render('home', { user: userData, products });
        } else {
            res.render("home", { products });
        }
    } catch (error) {
        console.error("error occurred ", error);
    }
};

// Verify OTP
const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                password: user.hashedPassword,
            });
            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({
                success: true,
                redirectUrl: "/",
                user: saveUserData,
            });
        } else {
            res.status(400).json({ success: false, message: "invalid OTP, please try again" });
        }
    } catch (error) {
        console.error("error verifying", error);
        res.status(500).json({ success: false, message: "an error occurred" });
    }
};

// Resend OTP
const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            res.render('verify-otp');
        } else {
            res.status(500).json({ success: false, message: "resend otp failed to send. please try again" });
        }
    } catch (error) {
        console.error("error sending otp", error);
        res.status(500).json({ success: false, message: "internal server error" });
    }
};

// Load Login Page
const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("login");
        } else {
            res.redirect("/");
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

// Handle Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ email });

        if (!findUser) {
            return res.render("login", { message: "user not found" });
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "user is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect email or password" });
        }

        const categories = await Category.find({ isListed: true });
        let products = await Product.find({
            isListed: true,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 },
        });

        products.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        products = products.slice(0, 6);

        req.session.user = findUser._id;
        res.render('home', { user: findUser, products });
    } catch (error) {
        console.error("login error", error);
        res.render("login", { message: "something went wrong please try again" });
    }
};

// Handle Logout
const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("destruction error");
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/");
        });
    } catch (error) {
        console.log("logout error", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    loadShoppingPage,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    filterProduct,
};