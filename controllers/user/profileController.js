const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt  =require('bcrypt');
const env = require('dotenv').config();
const session = require('express-session');
const otpGenerator =require('otp-generator');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');

function generateOtp(){
    const otp = otpGenerator.generate(6, { 
        lowerCaseAlphabets:false,
        upperCaseAlphabets: false, 
        specialChars: false 
    });
    console.log(otp);
    
    return otp;
}

const sendVerificationEmail=async(email,otp)=>{
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
        const mailOptions ={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for Password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP : ${otp}</h4><br></b>`,
        }
        
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent :',info.messageId);
        return true;
        
    } catch (error) {
        console.error('error sending email ',error);
        return false;
        
    }
}



const getForgotPassPage=async (req,res)=>{
    try {

        res.render('forgot-password');
        
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const forgotEmailValid = async(req,res)=>{
    try {

        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
          const otp =  generateOtp();
           const emailSent = await sendVerificationEmail(email,otp );
           if(emailSent){
            req.session.userOtp = otp;
            req.session.email = email;
            res.render('forgotPass-otp');
            console.log('OTP:',otp);
           }else{
            res.json({success:false,message:"Failes to send OTP , please try again"})
           }
        }else{
            res.render('forgot-password',{
                message:'User with this email does not exist'
            })
        }
        
    } catch (error) {
        console.log(error);
        res.redirect('/pageNotFound');
    }
}

const securePassword = async(password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;
        
    } catch (error) {
        
    }
}

const verifyForgotPassOtp = async(req,res)=>{
    try {

        const enteredOtp = req.body.otp;
        console.log(req.body)
        console.log(enteredOtp)
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:'/reset-pasword'});
        }
        else{
            res.json({success:false,message:'OTP not matching'});
        }
        
    } catch (error) {
        res.json({success:false, message:'an error occured . please try again'});
    }
}

const getResetPassPage = async(req,res)=>{
    try {
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const resendOtp = async(req,res)=>{
   

    console.log('reaching here');
    try {
        console.log("Session Data in resendOtp:", req.session.email); // in resendOtp
  
      const email = req.session.email;

      if(!email){
        return res.status(400).json({success:false,message:"email not found in session"});
    }
   
    const otp = generateOtp(); // Generate a new OTP
    
    req.session.userOtp = otp; // Update session with the new OTP
    console.log('otp stored',req.session.userOtp)
    const emailSent = await sendVerificationEmail(email,otp);
    if(emailSent){
        console.log("RESEND OTP : ",req.session.userOtp);
        res.render('forgotPass-otp');
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

const postNewPassword=async(req,res)=>{
    try {

        const {newPass1,newPass2} = req.body;
        console.log(newPass1,newPass2)
        const email = req.session.email ; 
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}

            )
            res.redirect('/login');
        }else{
            res.render('reset-password',{message:'password do not match'});
        }
        
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const userProfile = async(req,res)=>{
    try {
        const user = req.session.user;
        const userData = await User.findById(user);
        const addressData = await Address.findOne({userId:user});
        const orders = await Order.find({user}).sort({ createdAt: -1 });
        res.render('profile',{
            user:userData,
            userAddress:addressData,
            orders:orders,
        })
        
    } catch (error) {
        console.error('error retrieving user data',error);
        res.redirect('/pageNotFound');
    }
}

const addAddress = async(req,res)=>{
    try {
        const user = req.session.user;
        res.render('checkout-AddAddress',{user:user} );
        
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const checkoutAddAddress = async(req,res)=>{
    try {
        const user = req.session.user;
        res.render('checkout-AddAddress',{user:user} );
        
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}


const postAddAddress = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId});
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;

        const userAddress = await Address.findOne({userId:userData._id});
        if(!userAddress){
            const newAddress = new Address({
                userId:userData._id,
                address:({addressType,name,city,landMark,state,pincode,phone,altPhone}),
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
            await userAddress.save();
        }
        res.status(200).json({success:true,message:'Added succesfully'})
        
    } catch (error) {
       
        console.error('error adding address',error);
        res.status(500).json({success:false,error})
    }
}

const checkoutPostAddAddress = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId});
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;

        const userAddress = await Address.findOne({userId:userData._id});
        if(!userAddress){
            const newAddress = new Address({
                userId:userData._id,
                address:({addressType,name,city,landMark,state,pincode,phone,altPhone}),
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
            await userAddress.save();
        }
        res.status(200).json({success:true,message:'Added succesfully'})
        
    } catch (error) {
       
        console.error('error adding address',error);
        res.status(500).json({success:false,error})
    }
}

const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id; // Get the address ID from the query string
        const user = req.session.user; // Get the logged-in user from the session

        // Find the document containing the address
        const addressDocument = await Address.findOne({
            'address._id': addressId,
        });

        if (!addressDocument) {
            console.error('Address document not found');
            return res.redirect('/pageNotFound'); // Redirect if no document is found
        }

        // Extract the specific address from the array using Mongoose's .id() method
        const currAddress = addressDocument.address.id(addressId);

        if (!currAddress) {
            console.error('Specific address not found in the document');
            return res.redirect('/pageNotFound'); // Redirect if the specific address is not found
        }

        // Render the edit-address page with the address data and user information
        res.render('edit-address', {
            address: currAddress, // Pass the specific address object
            user: user,           // Pass the user object
        });
    } catch (error) {
        console.error('Error in edit address:', error);
        res.redirect('/pageNotFound'); // Redirect to a 404 page on error
    }
};


const checkoutEditAddress = async (req, res) => {
    try {
        const addressId = req.query.id; // Get the address ID from the query string
        const user = req.session.user; // Get the logged-in user from the session

        // Find the document containing the address
        const addressDocument = await Address.findOne({
            'address._id': addressId,
        });

        if (!addressDocument) {
            console.error('Address document not found');
            return res.redirect('/pageNotFound'); // Redirect if no document is found
        }

        // Extract the specific address from the array using Mongoose's .id() method
        const currAddress = addressDocument.address.id(addressId);

        if (!currAddress) {
            console.error('Specific address not found in the document');
            return res.redirect('/pageNotFound'); // Redirect if the specific address is not found
        }

        // Render the edit-address page with the address data and user information
        res.render('checkout-edit-address', {
            address: currAddress, // Pass the specific address object
            user: user,           // Pass the user object
        });
    } catch (error) {
        console.error('Error in edit address:', error);
        res.redirect('/pageNotFound'); // Redirect to a 404 page on error
    }
};

const postEditAddress = async(req,res)=>{
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({'address._id':addressId });
        if(!findAddress){
            res.redirect('/pageNotFound');
        }
        await Address.updateOne(
            {'address._id':addressId},
            {$set:{'address.$':{_id:addressId,
                addressType:data.addressType,
                name:data.name,
                city:data.city,
                landMark:data.landMark,
                state:data.state,
                pincode:data.pincode,
                phone:data.phone,
                altPhone:data.altPhone,
            }}}
        )
        res.status(200).json({success:true,message:'Edited succesfully'})
    } catch (error) {
       console.error('error in edit address',error);
       res.status(500).json({success:false,error})
        
    }
}


const checkoutPostEditAddress = async(req,res)=>{
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({'address._id':addressId });
        if(!findAddress){
            res.redirect('/pageNotFound');
        }
        await Address.updateOne(
            {'address._id':addressId},
            {$set:{'address.$':{_id:addressId,
                addressType:data.addressType,
                name:data.name,
                city:data.city,
                landMark:data.landMark,
                state:data.state,
                pincode:data.pincode,
                phone:data.phone,
                altPhone:data.altPhone,
            }}}
        )
        res.status(200).json({success:true,message:'Edited succesfully'})
    } catch (error) {
       console.error('error in edit address',error);
       res.status(500).json({success:false,error})
        
    }
}


const deleteAddress = async(req,res)=>{
    try {
        const addressId = req.query.id;
        const findAddress  = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            return res.status(404).send('Address not found');
        }
        await Address.updateOne(
            {'address._id':addressId},
            {$pull:{address:{_id:addressId,}}}
        );
        res.redirect('/userProfile');
    } catch (error) {
        console.error('error in deleting address');
        res.redirect('/pageNotFound');
        
    }
}





// Get order details for a specific order






module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    checkoutAddAddress,
    checkoutPostAddAddress,
    checkoutEditAddress,
    checkoutPostEditAddress,
    

    
}