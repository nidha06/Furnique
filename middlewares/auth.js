const User = require('../models/userSchema');


const userAuth = (req,res,next)=>{
     if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }
            else{
                res.redirect('/login');
            }
        })
        .catch(error=>{
            console.log("error in user auth middleware");
            res.status(500).send("internal server error");
        })
     }
     else{
        res.redirect("/login");
     }
}


const adminAuth = (req, res, next) => {
    // Check if admin session exists
    if (req.session.admin) {
        return next();  // Admin is logged in, allow access to the route
    } else {
        // Admin is not logged in, redirect to login page
        return res.redirect("/admin/login");
    }
};



module.exports={
    userAuth,
    
    adminAuth,
}