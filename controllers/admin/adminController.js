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

const login =async(req,res)=>{
    try {
        const {email,password}=req.body;
        console.log(req.body);
        //const admin = await User.findOne({email,isAdmin:true});
        const admin = await User.findOne({ email, isAdmin: true });
         console.log("Admin found:", admin);

        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password);
            console.log(passwordMatch);

            if(passwordMatch){
                req.session.admin=true;
                return res.redirect('/admin/dashboard');
            }
            else{
               return res.render('admin-login',{message:"Incorrect Password"});
            }
        }
        else{
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.log("login error",error);
        return res.error('/pageerror');
    }
}

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