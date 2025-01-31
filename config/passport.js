const passport = require('passport');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const models = require("../models/userSchema");
const User = require('../models/userSchema');
const env = require("dotenv").config();



passport.use(new GoogleStrategy(
    {
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'/auth/google/callback'
},


async (accessToken,refreshToken,profile,done)=>{
    try {
        const email= profile.emails[0].value;
        const googleId= profile.id
       let user = await User.findOne({email});
       if(user){
        if(!user.googleId){
            user.googleId=googleId
            await user.save()
        }else{
            user=await User.create({
                name:profile.displayName,
                googleId,
                email
            })
        }
        return done(null,user);
       }

    } catch (error) {
        console.log(error)
        return done(error,null);
    }
}))

passport.serializeUser((user,done)=>{
    done(null,user.id)
});

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null);
    })
});


module.exports = passport;


