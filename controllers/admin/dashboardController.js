const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Add this to your existing generateSalesReportData function
const generateSalesReportData = async (req) => {
    try {
        console.log(' Query varunnundooo?:', req.query);
        const { startDate, endDate, reportType } = req.query;
        let query = {};

        // Date range based on report type or custom dates
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
    console.log('jbkjnijnijnj',query);
    
        const orders = await Order.find(query)
            .populate('user', 'name email')
            .populate('items.product', 'name price')
            .sort({ createdAt: -1 });

        // Rest of your existing summary calculation code...
        const summary = orders.reduce(
            (acc, order) => {
                acc.totalOrders++;
                acc.totalAmount += order.totalPrice;
                acc.totalItems += order.items.length;

                // Add coupon discount if applied
                if (order.appliedCoupon && order.appliedCoupon.discountAmount) {
                    acc.couponDiscount += order.appliedCoupon.discountAmount;
                }

                 // Track payment methods
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

        return { 
            success: true, 
            summary, 
            orders,
            filters: { startDate, endDate, reportType } // Pass filters back to view
        };
    } catch (error) {
        console.error('Error generating sales report:', error);
        return { success: false, message: 'Error generating report' };
    }
};

// Update your getReport controller to pass the filters to the view
const getReport = async (req, res) => {
    try {
        const { success, summary, orders, filters } = await generateSalesReportData(req);
        if (!success) {
            return res.status(500).send('Error generating report');
        }
        res.render('salesReport', { 
            orders, 
            summary,
            ...filters // Spread the filters to make them available in the view
        });
    } catch (error) {
        console.error('Error rendering sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};

// ✅ Generate and Download Sales Report
const generateSalesReport = async (req, res) => {
    try {
        const { success, summary, orders } = await generateSalesReportData(req);
        if (!success) {
            return res.status(500).json({ success: false, message: 'Error generating report' });
        }

        const { format } = req.query;
        if (format === 'excel') {
            return await generateExcelReport(orders, summary, res);
        } else if (format === 'pdf') {
            return await generatePDFReport(orders, summary, res);
        }

        return res.json({ success: true, summary, orders });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, message: 'Error generating report' });
    }
};

// ✅ Generate Excel Report 📊
const generateExcelReport = async (orders, summary, res) => {
    try {
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

// ✅ Generate PDF Report 📄
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

module.exports = {
    getReport,
    generateSalesReport,
    generateSalesReportData,
    generatePDFReport
};


