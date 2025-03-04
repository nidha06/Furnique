const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },

    googleId: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
        required: false,
    },
    isListed: {
        type: Boolean,
        default: false,
    },
    isAdmin: {
        type: String,
        default: false,
    },
    isBlocked: {  // Add this field to track whether the user is blocked
        type: Boolean,
        default: false,  // Default is false (not blocked)
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    wallet: {
        type: Number,
        default: 0,
    },
   
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order",
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referralCode: {
        type: String,
        unique: true,
        required:false,
      },
     
    redeemed: {
        type: Boolean,
        // default: false,
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        // required: true,
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        searchOn: {
            type: Date,
            default: Date.now,
        }
    }]
});

const User = mongoose.model("User", userSchema);

module.exports = User;
