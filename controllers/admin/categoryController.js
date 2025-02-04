const Category = require('../../models/categorySchema');



const categoryInfo = async(req,res)=>{
    try {

        const page = parseInt(req.query.page) || 1;
        const limit =4;
        const skip =(page-1)*limit;


        const categoryData =await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories/limit);
        res.render('category',
          {
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories,
          }
        );
        
    } catch (error) {
      console.log(error);
      res.redirect('/pageerror');  
    }
}


const addCategory = async (req, res) => {
    let { name, description } = req.body;

    try {
        // Convert input name to lowercase for a consistent check
        const lowerCaseName = name.toLowerCase();

        // Case-insensitive search using regex and $options: 'i'
        const existingCategory = await Category.findOne({ 
            name: { $regex: `^${lowerCaseName}$`, $options: 'i' } 
        });

        if (existingCategory) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        // Save the category with the original case for display purposes
        const newCategory = new Category({
            name,
            description,
        });

        await newCategory.save();
        return res.json({ message: 'Category added successfully' });

    } catch (error) {
        console.error('Error in addCategory:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};



const getListCategory = async(req,res)=>{
    try {
        let id = req.body.categoryId;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        
        return res.status(200).json({success:true, message:"Succesfully unlisted"});
        
    } catch (error) {
        res.redirect('/pageerror');
    }
}


const getUnlistCategory = async(req,res)=>{
    try {
        const id =req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect('/admin/category');
    } catch (error) {
        res.redirect('/pageerror');
    }
}


const getEditCategory=async(req,res)=>{
    try {
        const id =req.query.id;    
        const category = await Category.findById(id);
        res.render('edit-category',{category:category})
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
}


const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        // Convert category name to lowercase for case-insensitive check
        const lowerCaseCategoryName = categoryName.trim().toLowerCase();

        // Find the existing category by ID
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        // If the name is changed, check for duplicate names (case-insensitive)
        if (existingCategory.name.toLowerCase() !== lowerCaseCategoryName) {
            const duplicateCategory = await Category.findOne({ 
                name: { $regex: new RegExp(`^${lowerCaseCategoryName}$`, "i") } // Case-insensitive regex
            });

            if (duplicateCategory) {
                return res.status(400).json({ error: "Category already exists, please choose another name" });
            }
        }

        // Update category
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName.trim(), description: description.trim() },
            { new: true }
        );

        if (updatedCategory) {
            return res.redirect('/admin/category'); // Redirect after successful update
        } else {
            return res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error("Error updating category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};



module.exports={
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
}