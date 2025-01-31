
const express= require('express');
const app = express();
const path = require('path');
const passport = require('./config/passport');
const env = require('dotenv').config();
const session = require('express-session')
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const db = require('./config/db');
db();


app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))


app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store');
    next();
})

app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')))
console.log('Views directories:', 
    path.join(__dirname,'views/user'), 
    path.join(__dirname,'views/admin')
  );
  
  console.log('Actual view file path:', 
    path.join(__dirname, 'views/admin/products.ejs')
  );


app.use('/',userRouter);
app.use('/admin',adminRouter);

app.listen(process.env.PORT, ()=>{
    console.log(`server is running on http://localhost:${process.env.PORT} `);
});


module.exports = app;