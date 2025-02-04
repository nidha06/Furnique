const mongoose = require('mongoose');
const env = require('dotenv').config();


const connectDB = async() =>{
    try{
       await mongoose.connect('mongodb://localhost:27017/furnique');
       console.log('database connected');
    }catch (error)
    {
      console.log('database connection error',error.message);
      process.exit(1);
    }
}

module.exports = connectDB;