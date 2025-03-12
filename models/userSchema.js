const mongoose = require('mongoose');
const { Schema } = mongoose;


// Helper function to generate a random referral code
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) { // Generate an 8-character code
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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

// Middleware to generate a unique referral code before saving
userSchema.pre('save', async function (next) {
    if (!this.referralCode) { // Only generate if referralCode is not already set
        let isUnique = false;
        let referralCode;

        // Keep generating codes until a unique one is found
        while (!isUnique) {
            referralCode = generateReferralCode();
            const existingUser = await mongoose.model('User').findOne({ referralCode });
            if (!existingUser) {
                isUnique = true;
            }
        }

        this.referralCode = referralCode.toUpperCase(); 
    }
    next(); 
});


const User = mongoose.model("User", userSchema);

module.exports = User;
