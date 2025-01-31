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


const addCategory=async(req,res)=>{
    const {name,description}=req.body;
    try {

       const existingCategory = await Category.findOne({name});
       if(existingCategory){
        return res.status(400).json({error:'Category alresdy exists'});
       } 
       const newCategory = new Category({
            name,
            description,
       }) 
       await newCategory.save();
       return res.json({message:'category added successfully'})

    } catch (error) {
        return res.status(500).json({error:'internal server error'});
    }
}


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
        const { categoryname, description } = req.body;

       
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

       
        if (existingCategory.name !== categoryname) {
            const duplicateCategory = await Category.findOne({ name: categoryname });
            if (duplicateCategory) {
                return res.status(400).json({ error: "Category exists, please choose another name" });
            }
        }

        // update category
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryname, description: description },
            { new: true }
        );

        if (updatedCategory) {
            res.redirect('/admin/category'); //  updated
        } else {
            res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: "Internal server error" });
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