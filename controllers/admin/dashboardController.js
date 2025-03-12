const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Product = require('../../models/productSchema'); // Assuming you have a product schema
const User = require('../../models/userSchema'); 

// Add this to your existing generateSalesReportData function
const generateSalesReportData = async (req) => {
    try {
        const { startDate, endDate, reportType } = req.query;
        let query = {
            status: 'delivered' // Add filter for delivered orders
        };


        // Apply filters based on the provided parameters
        if (startDate && endDate && reportType === 'custom') {
            query.createdAt = { 
                $gte: new Date(startDate), 
                $lte: new Date(endDate)
            };
        } else if (reportType) {
            const now = new Date();
            switch (reportType) {
                case 'daily':
                    query.createdAt = {
                        $gte: new Date(now.setHours(0, 0, 0, 0)),
                        $lte: new Date(now.setHours(23, 59, 59, 999))
                    };
                    break;
                case 'weekly':
                    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                    weekStart.setHours(0, 0, 0, 0);
                    query.createdAt = { 
                        $gte: weekStart, 
                        $lte: new Date() 
                    };
                    break;
                case 'monthly':
                    query.createdAt = {
                        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                        $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                    };
                    break;
            }
        }

        // Fetch orders with the query
        const orders = await Order.find(query)
            .populate('user', 'name email')
            .populate('items.product', 'name price')
            .sort({ createdAt: -1 });

            console.log('dasfaf',orders);
            
        
        // Calculate summary
        const summary = orders.reduce(
            (acc, order) => {
                acc.totalOrders++;
                acc.totalAmount += order.totalPrice;
                acc.totalItems += order.items.length;
                if (order.appliedCoupon && order.appliedCoupon.discountAmount) {
                    acc.couponDiscount += order.appliedCoupon.discountAmount;
                }
                acc.paymentMethods[order.paymentMethod] = (acc.paymentMethods[order.paymentMethod] || 0) + 1;
                return acc;
            },
            {
                totalOrders: 0,
                totalAmount: 0,
                totalItems: 0,
                couponDiscount: 0,
                paymentMethods: {}
            }
        );
        // console.log(orders);
        return { 
            success: true, 
            summary, 
            orders
        };
    } catch (error) {
        console.error('Error generating sales report:', error);
        return { success: false, message: 'Error generating report' };
    }
};

// Update your getReport controller to pass the filters to the view
const getReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.query;
        const { success, summary, orders, filters } = await generateSalesReportData(req);
        if (!success) {
            return res.status(500).send('Error generating report');
        }
        res.render('salesReport', { 
            orders, 
            summary,
            ...filters,
            reportType: reportType || '', // Pass reportType or default to an empty string
            startDate: startDate || '',   // Pass startDate or default to an empty string
            endDate: endDate || ''// Spread the filters to make them available in the view
        });
        console.log(summary);
        console.log(orders);
        
        
    } catch (error) {
        console.error('Error rendering sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};


const generateSalesReport = async (req, res) => {
    try {
        // Extract filter parameters from the request query
        const { format, startDate, endDate, reportType } = req.query;
        
        // Fetch filtered sales report data
        const { success, summary, orders } = await generateSalesReportData(req);

        if (!success) {
            return res.status(500).json({ success: false, message: 'Error generating report' });
        }

        // Generate report based on the requested format
        if (format === 'excel') {
            return await generateExcelReport(orders, summary, res);
        } else if (format === 'pdf') {
            return await generatePDFReport(orders, summary, res);
        }

        // Return JSON response if no format is specified
        return res.json({ success: true, summary, orders });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, message: 'Error generating report' });
    }
};
const generateExcelReport = async (orders, summary, res) => {
    try {
        console.log(orders)
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add headers
        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 15 },
            { header: 'Customer', key: 'customer', width: 20 },
            { header: 'Total Amount', key: 'amount', width: 15 },
            { header: 'Date', key: 'date', width: 20 }
        ];

        // Add rows
        orders.forEach(order => {
            worksheet.addRow({
                orderId: order._id.toString(),
                customer: order.user.name,
                amount: order.totalPrice,
                date: order.createdAt.toISOString().split('T')[0]
            });
        });

        // Write to file
        const filePath = path.join(__dirname, '../../public/reports/sales_report.xlsx');
        await workbook.xlsx.writeFile(filePath);

        // Send file to user
        res.download(filePath, 'Sales_Report.xlsx', () => {
            fs.unlinkSync(filePath); // Delete after download
        });
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Error generating Excel report');
    }
};


const generatePDFReport = async (orders, summary, res) => {
    try {
        const doc = new PDFDocument({ margin: 30 });
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        // Title
        doc.fontSize(16).text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Summary section
        doc.fontSize(12).text(`Total Orders: ${summary.totalOrders}`);
        doc.text(`Total Sales: ₹${summary.totalAmount.toFixed(2)}`);
        doc.text(`Total Coupon Discounts: ₹${summary.couponDiscount.toFixed(2)}`);
        doc.moveDown();

        // Table headers
        const tableTop = doc.y;
        const colWidths = [50, 150, 100, 100, 100, 100];

        doc.font('Helvetica-Bold');
        doc.text('No', 50, tableTop);
        doc.text('Customer', 100, tableTop);
        doc.text('Total Price', 250, tableTop);
        doc.text('Payment Method', 350, tableTop);
        doc.text('Date', 450, tableTop);
        doc.text('Items', 550, tableTop);
        doc.moveDown();
        doc.font('Helvetica');

        // Table rows
        orders.forEach((order, index) => {
            const y = tableTop + 20 + (index * 20);
            doc.text(index + 1, 50, y);
            doc.text(order.user?.name || 'Guest', 100, y);
            doc.text(`₹${order.totalPrice.toFixed(2)}`, 250, y);
            doc.text(order.paymentMethod, 350, y);
            doc.text(order.createdAt.toISOString().split('T')[0], 450, y);
            doc.text(order.items.length.toString(), 550, y);
        });

        // End the document
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
};



// Dashboard controller
const getDashboard = async (req, res) => {
    try {
       
        // Time periods for filters
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        
        // For weekly data
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        // For monthly data
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        // For yearly data
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

        // Get counts for dashboard stats
        const totalUsers = await User.countDocuments();
        
        
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        
        // Get weekly sales count
        const weeklySales = await Order.countDocuments({
            createdAt: { $gte: startOfWeek, $lte: endOfDay }
        });

        // Financial stats
        const allOrders = await Order.find();
        
        // Calculate revenue
        const revenue = allOrders.reduce((total, order) => total + order.totalPrice, 0);
        
        // Calculate month-over-month revenue
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const currentMonthOrders = await Order.find({
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });
        const lastMonthOrders = await Order.find({
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });
        
        const currentMonthRevenue = currentMonthOrders.reduce((total, order) => total + order.totalPrice, 0);
        const lastMonthRevenue = lastMonthOrders.reduce((total, order) => total + order.totalPrice, 0);
        
        // Calculate revenue percent change
        const revenuePercentChange = lastMonthRevenue === 0 ? 0 : 
            ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

        // Calculate sales (could be different from revenue if you have returns or other adjustments)
        const sales = currentMonthRevenue; // Or use a different calculation if needed
        const lastMonthSales = lastMonthRevenue;
        const salesPercentChange = lastMonthSales === 0 ? 0 : 
            ((sales - lastMonthSales) / lastMonthSales) * 100;

        // Calculate purchase (cost of goods sold)
        // This is a placeholder calculation - adjust based on your business logic
        const purchase = currentMonthOrders.reduce((total, order) => {
            // Assuming a 40% profit margin as an example
            return total + (order.totalPrice * 0.6);
        }, 0);
        
        const lastMonthPurchase = lastMonthOrders.reduce((total, order) => {
            return total + (order.totalPrice * 0.6);
        }, 0);
        
        const purchasePercentChange = lastMonthPurchase === 0 ? 0 : 
            ((purchase - lastMonthPurchase) / lastMonthPurchase) * 100;
            
        // Find top 5 selling products
        const topProducts = await Order.aggregate([
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product",
                    totalSold: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "products", // Your actual collection name
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $project: {
                    name: "$productDetails.productName",
                    image: { $arrayElemAt: ["$productDetails.images", 0] },
                    totalSold: 1,
                    revenue: 1
                }
            }
        ]);

        
        
                // Find top 2 best-selling categories
                const topCategories = await Order.aggregate([
                    { $unwind: "$items" }, // Unwind the items array
                    {
                        $lookup: {
                            from: "products", // Join with products collection
                            localField: "items.product",
                            foreignField: "_id",
                            as: "productDetails"
                        }
                    },
                    { $unwind: "$productDetails" }, // Flatten the productDetails array
                    {
                        $group: {
                            _id: "$productDetails.category", // Group by category ID
                            totalSold: { $sum: "$items.quantity" }, // Total quantity sold
                            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } // Total revenue
                        }
                    },
                    { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
                    { $limit: 2 }, // Limit to top 2 categories
                    {
                        $lookup: {
                            from: "categories", // Join with categories collection
                            localField: "_id",
                            foreignField: "_id",
                            as: "categoryDetails"
                        }
                    },
                    { $unwind: "$categoryDetails" }, // Flatten the categoryDetails array
                    {
                        $project: {
                            name: "$categoryDetails.name", // Category name
                            image: { $arrayElemAt: ["$categoryDetails.images", 0] }, // First image of the category
                            totalSold: 1,
                            revenue: 1
                        }
                    }
                ]);
        
            
        const monthlySalesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfYear, $lte: endOfYear }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    totalSales: { $sum: "$totalPrice" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Convert month numbers to names for better readability
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        
        const chartData = monthlySalesData.map(item => ({
            month: monthNames[item._id - 1],
            totalSales: item.totalSales,
            orderCount: item.count
        }));
        console.log('top:',topProducts);
        
        // Render dashboard with data
        res.render('dashboard', {
            stats: {
                totalUsers,
                totalProducts,
                totalOrders,
                weeklySales
            },
            financials: {
                revenue: {
                    amount: revenue,
                    percentChange: revenuePercentChange.toFixed(2),
                    isPositive: revenuePercentChange >= 0
                },
                sales: {
                    amount: sales,
                    percentChange: salesPercentChange.toFixed(2),
                    isPositive: salesPercentChange >= 0
                },
                purchase: {
                    amount: purchase,
                    percentChange: purchasePercentChange.toFixed(2),
                    isPositive: purchasePercentChange >= 0
                }
            },
            topProducts,
           
            chartData,
            topCategories,
        });
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        res.status(500).send('Error loading dashboard data');
    }
};

// Function to get sales data by time period for AJAX requests
const getSalesDataByPeriod = async (req, res) => {
    try {
        const { period } = req.query; // 'daily', 'weekly', 'monthly', 'yearly'
        const now = new Date();
        let startDate, endDate;
        let groupBy;

        switch (period) {
            case 'daily':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                endDate = new Date(now.setHours(23, 59, 59, 999));
                groupBy = { $hour: "$createdAt" };
                break;
            case 'weekly':
                // Go back to last Sunday
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startDate = new Date(startOfWeek.setHours(0, 0, 0, 0));
                endDate = new Date(now.setHours(23, 59, 59, 999));
                groupBy = { 
                    dayOfWeek: { $dayOfWeek: "$createdAt" }, 
                    day: { $dayOfMonth: "$createdAt" },
                    month: { $month: "$createdAt" }
                };
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                groupBy = { $dayOfMonth: "$createdAt" };
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                groupBy = { $month: "$createdAt" };
                break;
            default:
                // Default to monthly
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                groupBy = { $dayOfMonth: "$createdAt" };
        }

        let aggregation;
        
        if (period === 'weekly') {
            // Special case for weekly to get day names
            aggregation = [
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: { 
                            dayOfWeek: { $dayOfWeek: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" },
                            month: { $month: "$createdAt" }
                        },
                        totalSales: { $sum: "$totalPrice" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.dayOfWeek": 1 } }
            ];
        } else {
            aggregation = [
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: groupBy,
                        totalSales: { $sum: "$totalPrice" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ];
        }

        const salesData = await Order.aggregate(aggregation);
        
        // Format the response data based on the period
        let formattedData;
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        
        if (period === 'daily') {
            formattedData = Array.from({ length: 24 }, (_, i) => ({
                label: `${i}:00`,
                sales: 0,
                orders: 0
            }));
            
            salesData.forEach(item => {
                const hour = item._id;
                if (hour >= 0 && hour < 24) {
                    formattedData[hour] = {
                        label: `${hour}:00`,
                        sales: item.totalSales,
                        orders: item.count
                    };
                }
            });
        } else if (period === 'weekly') {
            formattedData = salesData.map(item => ({
                label: dayNames[item._id.dayOfWeek - 1],
                fullDate: `${monthNames[item._id.month - 1]} ${item._id.day}`,
                sales: item.totalSales,
                orders: item.count
            }));
        } else if (period === 'monthly') {
            // Create an array for all days in the month
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            formattedData = Array.from({ length: daysInMonth }, (_, i) => ({
                label: `Day ${i + 1}`,
                sales: 0,
                orders: 0
            }));
            
            salesData.forEach(item => {
                const day = item._id - 1; // Convert to 0-indexed
                if (day >= 0 && day < daysInMonth) {
                    formattedData[day] = {
                        label: `Day ${item._id}`,
                        sales: item.totalSales,
                        orders: item.count
                    };
                }
            });
        } else if (period === 'yearly') {
            formattedData = Array.from({ length: 12 }, (_, i) => ({
                label: monthNames[i],
                sales: 0,
                orders: 0
            }));
            
            salesData.forEach(item => {
                const month = item._id - 1; // Convert to 0-indexed
                if (month >= 0 && month < 12) {
                    formattedData[month] = {
                        label: monthNames[month],
                        sales: item.totalSales,
                        orders: item.count
                    };
                }
            });
        }
        
        res.json({
            success: true,
            data: formattedData,
            period
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ success: false, message: 'Error fetching sales data' });
    }
};

module.exports = {
    getReport,
    generateSalesReport,
    generateSalesReportData,
    generatePDFReport,
    getDashboard,
    getSalesDataByPeriod,
};

