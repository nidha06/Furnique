const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt  =require('bcrypt');
const env = require('dotenv').config();
const session = require('express-session');
const otpGenerator =require('otp-generator');

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




module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    
}