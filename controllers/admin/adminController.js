const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');



const pageerror = async(req,res)=>{
    res.render("pageerror");
}


const loadLogin=(req,res)=>{
    
    if(req.session.admin){
        return res.redirect('/admin/dashboard');
    }
    res.render('admin-login',{message:null})
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Request body:', req.body);

        // Input validation
        if (!email || !password) {
            return res.render('admin-login', { message: 'Email and password are required' });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('admin-login', { message: 'Please enter a valid email address' });
        }

        // Password length validation
        if (password.length < 8) {
            return res.render('admin-login', { message: 'Password must be at least 8 characters long' });
        }

        // Find admin user
        const admin = await User.findOne({ email, isAdmin: true });
        console.log('Admin found:', admin);

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            console.log('Password match:', passwordMatch);

            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect('/admin/dashboard');
            } else {
                return res.render('admin-login', { message: 'Incorrect Password' });
            }
        } else {
            return res.render('admin-login', { message: 'Only admin can access the admin panel' });
        }
    } catch (error) {
        console.log('Login error:', error);
        return res.status(500).render('pageerror', { message: 'An error occurred during login. Please try again later.' });
    }
};

const loadDashboard = async (req,res)=>{
    
    if (req.session.admin){
    try {
       return res.render('dashboard')        
    } catch (error) {
        res.redirect('/admin/login');
    }
}
}


const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/pageerror');
        }
        res.redirect('/admin/login'); // Redirect to login page after session is destroyed
    });
};


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
}