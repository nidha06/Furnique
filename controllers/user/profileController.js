const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config();
const session = require('express-session');
const otpGenerator = require('otp-generator');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');

function generateOtp() {
    const otp = otpGenerator.generate(6, { 
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false, 
        specialChars: false 
    });
    console.log(otp);
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for Password reset",
            text: `Your OTP is ${otp}`,
            html: `Your OTP : ${otp}`,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent :', info.messageId);
        return true;
    } catch (error) {
        console.error('error sending email ', error);
        return false;
    }
};

const getForgotPassPage = async (req, res) => {
    try {
        res.render('forgot-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render('forgotPass-otp');
                console.log('OTP:', otp);
            } else {
                res.json({ success: false, message: "Failed to send OTP, please try again" });
            }
        } else {
            res.render('forgot-password', {
                message: 'User with this email does not exist'
            });
        }
    } catch (error) {
        console.log(error);
        res.redirect('/pageNotFound');
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {}
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        console.log(req.body);
        console.log(enteredOtp);
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: '/reset-pasword' });
        } else {
            res.json({ success: false, message: 'OTP not matching' });
        }
    } catch (error) {
        res.json({ success: false, message: 'An error occurred. Please try again' });
    }
};

const getResetPassPage = async (req, res) => {
    try {
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const resendOtp = async (req, res) => {
    console.log('reaching here');
    try {
        console.log("Session Data in resendOtp:", req.session.email);
        const email = req.session.email;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }
        const otp = generateOtp();
        req.session.userOtp = otp;
        console.log('otp stored', req.session.userOtp);
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("RESEND OTP : ", req.session.userOtp);
            res.render('forgotPass-otp');
        } else {
            res.status(500).json({ success: false, message: "Resend OTP failed to send. Please try again" });
        }
    } catch (error) {
        console.error("Error sending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        console.log(newPass1, newPass2);
        const email = req.session.email;
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );
            res.redirect('/login');
        } else {
            res.render('reset-password', { message: 'Passwords do not match' });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const userProfile = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findById(user);
        const addressData = await Address.findOne({ userId: user });
        const orders = await Order.find({ user }).sort({ createdAt: -1 });
        res.render('profile', {
            user: userData,
            userAddress: addressData,
            orders: orders,
        });
    } catch (error) {
        console.error('Error retrieving user data', error);
        res.redirect('/pageNotFound');
    }
};

const addAddress = async (req, res) => {
    try {
        const user = req.session.user;
        res.render('add-address', { user: user });
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const checkoutAddAddress = async (req, res) => {
    try {
        const user = req.session.user;
        res.render('checkout-AddAddress', { user: user });
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: ({ addressType, name, city, landMark, state, pincode, phone, altPhone }),
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        res.status(200).json({ success: true, message: 'Added successfully' });
    } catch (error) {
        console.error('Error adding address', error);
        res.status(500).json({ success: false, error });
    }
};

const checkoutPostAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: ({ addressType, name, city, landMark, state, pincode, phone, altPhone }),
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        res.status(200).json({ success: true, message: 'Added successfully' });
    } catch (error) {
        console.error('Error adding address', error);
        res.status(500).json({ success: false, error });
    }
};

const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const addressDocument = await Address.findOne({ 'address._id': addressId });
        if (!addressDocument) {
            console.error('Address document not found');
            return res.redirect('/pageNotFound');
        }
        const currAddress = addressDocument.address.id(addressId);
        if (!currAddress) {
            console.error('Specific address not found in the document');
            return res.redirect('/pageNotFound');
        }
        res.render('edit-address', {
            address: currAddress,
            user: user,
        });
    } catch (error) {
        console.error('Error in edit address:', error);
        res.redirect('/pageNotFound');
    }
};

const checkoutEditAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const addressDocument = await Address.findOne({ 'address._id': addressId });
        if (!addressDocument) {
            console.error('Address document not found');
            return res.redirect('/pageNotFound');
        }
        const currAddress = addressDocument.address.id(addressId);
        if (!currAddress) {
            console.error('Specific address not found in the document');
            return res.redirect('/pageNotFound');
        }
        res.render('checkout-edit-address', {
            address: currAddress,
            user: user,
        });
    } catch (error) {
        console.error('Error in edit address:', error);
        res.redirect('/pageNotFound');
    }
};

const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ 'address._id': addressId });
        if (!findAddress) {
            res.redirect('/pageNotFound');
        }
        await Address.updateOne(
            { 'address._id': addressId },
            { $set: { 'address.$': { _id: addressId, ...data } } }
        );
        res.status(200).json({ success: true, message: 'Edited successfully' });
    } catch (error) {
        console.error('Error in edit address', error);
        res.status(500).json({ success: false, error });
    }
};

const checkoutPostEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ 'address._id': addressId });
        if (!findAddress) {
            res.redirect('/pageNotFound');
        }
        await Address.updateOne(
            { 'address._id': addressId },
            { $set: { 'address.$': { _id: addressId, ...data } } }
        );
        res.status(200).json({ success: true, message: 'Edited successfully' });
    } catch (error) {
        console.error('Error in edit address', error);
        res.status(500).json({ success: false, error });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send('Address not found');
        }
        await Address.updateOne(
            { 'address._id': addressId },
            { $pull: { address: { _id: addressId } } }
        );
        res.redirect('/userProfile');
    } catch (error) {
        console.error('Error in deleting address');
        res.redirect('/pageNotFound');
    }
};

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
};