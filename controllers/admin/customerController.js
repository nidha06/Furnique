const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || ""; 
        let page = parseInt(req.query.page) || 1;
        const limit = 4;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        }).countDocuments();

        const totalPage = Math.ceil(count / limit); 

        //console.log({ userData, count, totalPage, search, page, limit });

        // Pass data to the EJS template
        res.render('customers', {
            data: userData,
            count: count,
            totalPage: totalPage, 
            search: search,
            currentPage: page, 
            limit: limit,
        });
    } catch (error) {
        console.error("Error fetching customer info:", error);
        res.status(500).send("Internal Server Error");
    }
};


const customerBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        console.log("Blocking user with ID:", id); // Debugging log
        const result = await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        console.log("Update result:", result); // Debugging log
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error blocking user:", error); // Debugging log
        res.redirect("/pageerror");
    }
};

const customerunBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        console.log("Unblocking user with ID:", id); // Debugging log
        const result = await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        console.log("Update result:", result); // Debugging log
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error unblocking user:", error); // Debugging log
        res.redirect('/pageerror');
    }
};

module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked,
};
