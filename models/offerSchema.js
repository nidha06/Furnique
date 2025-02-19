const mongoose = require('mongoose');
const {Schema} = mongoose;

const offerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    discount_type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discount_value: {
        type: Number,
        required: true
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    minimum_purchase: {
        type: Number,
        required: true
    },
    status: {
       type:String,
        default:'active'
    },
    categories:{
        type: Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    products:{
        type: Schema.Types.ObjectId,
        ref:"Product",
        required:true
    },
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);