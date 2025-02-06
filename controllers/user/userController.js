const User = require("../../models/userSchema");
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const env =require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");


const loadSignup = async(req,res)=>{
    try {
        res.render('signup')
    } catch (error) {
       console.log('home page load failed');
       res.status(500).send('internal server error'); 
    }
}

async function sendVerificationEmail(email,otp){
    try {
        
      const transporter = nodemailer.createTransport({
        service:'gmail',
        port:587,
        secure:false,
        requireTLS:true,
        auth:{
            user:process.env.NODEMAILER_EMAIL,
            pass:process.env.NODEMAILER_PASSWORD,
        }
      })

      const info = await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to :email,
        subject:'verify your account',
        text :`Your OTP is ${otp}`,
        html:`<b>Your OTP: ${otp} </b>`,
      })

      return info.accepted.length >0



    } catch (error) {
       
        console.error('Error sending email...', error.message, error.stack);

        return false;

    }
}


//GENERATING OTP....
function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()
}



const signup = async(req,res)=>{
    try {
        
      const {name,email,password,cpassword} = req.body;
     // console.log("Session Data:", req.session.userData); // Check session data

      if(password !== cpassword){
        return res.render("signup",{message:"pass word do not match"});
      }

      const findUser = await User.findOne({email})
      if(findUser){
        return res.render("signup",{message:'user already exist in this mail id'});
      }

      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);

      if(!emailSent){
        return res.json('email.error')
      }

      const hashedPassword = await bcrypt.hash(password,12)
      req.session.userOtp = otp;
      req.session.userData ={name,email,hashedPassword};
     

      res.render('verify-otp');
      console.log('otp sent',otp);

    } catch (error) {
        console.log('signup error',error);
        res.redirect('/pageNotFound');
    }
}

const loadShoppingPage = async(req,res)=>{
    try {
        const user = req.session.user;
       
        let cart = null;

        const userData = await User.findOne({_id:user});
        const categories = await Category.find({isListed:true});
        const categoryIds = categories.map((category)=>category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page-1)*limit;
        const products = await Product.find({
            isListed:true,
            category:{$in:categoryIds},
            quantity:{$gt:0}
        }).sort({createdOn:-1}).skip(skip).limit(limit);

        const totalProducts = await Product.countDocuments({
            isListed:true,
            category:{$in:categoryIds},
            quantity:{$gt:0}
        });

        const totalPages = Math.ceil(totalProducts/limit);
        const categoriesWithIds = categories.map(category=>({_id:category._id,name:category.name}))
       
           
        cart = await Cart.findOne({ user }).populate('items.product'); // Fetch the user's cart
        
        res.render('shop',{
            user:userData,
            products:products,
            category:categoriesWithIds,
            totalProducts:totalProducts,
            currentPage:page,
            totalPages:totalPages,
            cart,

     } )
    } catch (error) {
        console.log('shopping page not loading');
        res.status(500).send('internal server error');
    }
}

const pageNotFound = async(req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const loadHomepage = async(req,res)=>{
   try {
    const user = req.session.user;
    const categories = await Category.find({isListed:true});
    
    let products = await Product.find({
        isListed:true,
        category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
    });
    

    products.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    products= products.slice(0,6);
    
    if(user){
        const userData = await User.findOne({_id:user._id});
       
        res.render('home',{user:userData,products:products});
    }
    else{
       return res.render("home",{products:products});
    }
   } catch (error) {
    console.error("error occured ",error)
   }
}




const verifyOtp = async(req,res)=>{
       try {
        
        const {otp} = req.body;
        console.log(otp);

        console.log(req.session);

        if(otp===req.session.userOtp){
            const user = req.session.userData;
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                password:user.hashedPassword,

            })
            await saveUserData.save()
            req.session.user = saveUserData._id;
            res.json({
                success:true,
                redirectUrl:"/",
                user:saveUserData

            })
        }else{
            res.status(400).json({success:false,message:"invalid OTP,please try again"})
        }
        

       } catch (error) {
        
            console.error("error verifynin",error);
            res.status(500).json({success:false,message:"an error occured"})

       }
}


const resendOtp = async(req,res)=>{
   

    console.log('reaching here');
    try {
        console.log("Session Data in resendOtp:", req.session.userData); // in resendOtp
  
      const {email} = req.session.userData;
      if(!email){
        return res.status(400).json({success:false,message:"email not found in session"});
    }
   
    const otp = generateOtp(); // Generate a new OTP
    
    req.session.userOtp = otp; // Update session with the new OTP
    console.log('otp stored',req.session.userOtp)
    const emailSent = await sendVerificationEmail(email,otp);
    if(emailSent){
        console.log("RESEND OTP : ",req.session.userOtp);
        res.render('verify-otp');
        // res.status(200).json({success:true,message:"resend otp successfully sent"});
    }
    else{
        res.status(500).json({success:false,message:"resend otp failed to send . please try again"})
    }

    } catch (error) {
        console.error("error sending otp",error);
        res.status(500).json({success:false,message:"internal server error"});
        
    }
}


const loadLogin = async(req,res)=>{
    try {
        if(!req.session.user){
           return res.render("login");
        }
        else{
            res.redirect("/");
        }
   

    } catch (error) {
       res.redirect("/pageNotFound");
        
    }
}


const login = async(req,res)=>{
    try {
        
        const {email,password} = req.body;
        const findUser = await User.findOne({email});

        if(!findUser){
            return res.render("login",{message:" user not found"});
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"user is blocked by admin"});
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect email or password"});
        }
        const categories = await Category.find({isListed:true});

        let products = await Product.find({
            isListed:true,
            category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
        });
        
    
        products.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        products= products.slice(0,6);

        req.session.user = findUser._id;
        
        res.render('home',{user:findUser,products})


    } catch (error) {
        console.error("login error",error);
        res.render("login",{message:"something went wrong please try again"});
         
    }
  
}


const logout = async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("destruction error");
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/");
        })

    } catch (error) {
        console.log("logout error",error);
        res.redirect("/pageNotFound")

    }
}


const filterProduct = async(req,res)=>{
    try {
        let cart = null;
        const user = req.session.user;
        const category =req.query.category;
        const findCategory = category ? await Category.findOne({_id:category}):null;
        const query = {
            isListed:true,
            quantity:{$gt:0}
        }

        if(findCategory){
            query.category = findCategory._id;
        }


        let findProducts = await Product.find(query).lean();
        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        
        const categories = await Category.find({isListed:true});

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex =(currentPage-1)*itemsPerPage;
        let endIndex =startIndex+itemsPerPage;
        let totalPages = Math.ceil(findProducts.length/itemsPerPage);
        const currentProduct = findProducts.slice(startIndex,endIndex);
        let userData =null;
        if(user){
            userData = await User.findOne({_id:user});
            if(userData){
                const searchEntry = {
                    category:findCategory ? findCategory._id : null,
                    searchedOn :new Date(),
                }
                userData.searchHistory.push(searchEntry);
                await userData.save()
            }
        }

        req.session.filteredProducts = currentProduct ;
        
            cart = await Cart.findOne({ user }).populate('items.product');
     
        res.render('shop',{
            user:userData,
            products:currentProduct,
            category:categories,
            totalPages,
            currentPage,
            selectedCategory:category || null,
            cart,

        })
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}



module.exports = {
     loadHomepage ,
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
  
}

