const mongoose = require('mongoose');
require('dotenv').config();


const connectDB = async() =>{
    try{
       await mongoose.connect(process.env.MONGODB_URI);
       console.log('database connected');
    }catch (error)
    {
      console.log('database connection error',error.message);
      process.exit(1);
    }
}

module.exports = connectDB;