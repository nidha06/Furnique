const { session } = require('passport');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');

const getOrderList = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt returnRequest');
        if (!orders || orders.length === 0) {
            return res.json({ success: false, message: "No orders found." });
        }

        const simplifiedOrders = await Promise.all(
            orders.map(async (order) => {
                const itemsWithImages = await Promise.all(
                    order.items.map(async (item) => {
                        const product = await Product.findById(item.product);
                        return {
                            productName: item.productName,
                            quantity: item.quantity,
                            price: item.price,
                            image: product?.images[0] || ['default-image.jpg'],
                        };
                    })
                );

                return {
                    _id: order._id,
                    user: {
                        name: order.user?.name || 'Unknown User',
                        email: order.user?.email || 'Unknown Email',
                    },
                    shippingAddress: {
                        name: order.shippingAddress.name,
                        city: order.shippingAddress.city,
                        state: order.shippingAddress.state,
                        pincode: order.shippingAddress.pincode,
                    },
                    paymentMethod: order.paymentMethod,
                    items: itemsWithImages,
                    totalPrice: order.totalPrice,
                    status: order.status,
                    createdAt: order.createdAt,
                };
            })
        );

        res.render('orders', { orders: simplifiedOrders });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt cancellationReason returnRequest appliedCoupon');
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const itemsWithImages = await Promise.all(
            order.items.map(async (item) => {
                const product = await Product.findById(item.product);
                return {
                    _id: item._id,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    status: item.status || order.status, // Use item status if available, else use order status
                    image: product?.images?.[0] || 'default-image.jpg',
                    returnRequest: item.returnRequest || null
                };
            })
        );

        
       

        const simplifiedOrder = {
            _id: order._id,
            user: {
                _id: order.user?._id || '',
                name: order.user?.name || 'Unknown User',
                email: order.user?.email || 'Unknown Email',
            },
            shippingAddress: {
                name: order.shippingAddress.name,
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
            },
            paymentMethod: order.paymentMethod,
            items: itemsWithImages,
            totalPrice: order.totalPrice,
            status: order.status,
            cancellationReason: order.cancellationReason,
            createdAt: order.createdAt,
            returnRequest: order.returnRequest || null,
            appliedCoupon: order.appliedCoupon
                ? {
                      code: order.appliedCoupon.code || 'No Coupon',
                      discountAmount: order.appliedCoupon.discountAmount || 0,
                  }
                : null,
        };
        console.log('simplified:', simplifiedOrder);
        res.render('order-details', { order: simplifiedOrder });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send('Internal Server Error');
    }
};




// View Invoice
const viewInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt cancellationReason returnRequest appliedCoupon');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const itemsWithImages = await Promise.all(
            order.items.map(async (item) => {
                const product = await Product.findById(item.product);
                return {
                    id: item.id,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    status: item.status || order.status,
                    image: product?.images?.[0] || 'default-image.jpg',
                    returnRequest: item.returnRequest || null,
                };
            })
        );

        const simplifiedOrder = {
            id: order.id,
            user: {
                id: order.user?.id || '',
                name: order.user?.name || 'Unknown User',
                email: order.user?.email || 'Unknown Email',
            },
            shippingAddress: {
                name: order.shippingAddress.name,
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
            },
            paymentMethod: order.paymentMethod,
            items: itemsWithImages,
            totalPrice: order.totalPrice,
            status: order.status,
            cancellationReason: order.cancellationReason,
            createdAt: order.createdAt,
            returnRequest: order.returnRequest || null,
            appliedCoupon: order.appliedCoupon
                ? {
                      code: order.appliedCoupon.code || 'No Coupon',
                      discountAmount: order.appliedCoupon.discountAmount || 0,
                  }
                : null,
        };

        res.render('invoice', { order: simplifiedOrder });
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Download PDF Invoice
const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .select('shippingAddress paymentMethod items totalPrice status createdAt cancellationReason returnRequest appliedCoupon');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const itemsWithImages = await Promise.all(
            order.items.map(async (item) => {
                const product = await Product.findById(item.product);
                return {
                    id: item.id,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    status: item.status || order.status,
                    image: product?.images?.[0] || 'default-image.jpg',
                    returnRequest: item.returnRequest || null,
                };
            })
        );

        const simplifiedOrder = {
            id: order.id,
            user: {
                id: order.user?.id || '',
                name: order.user?.name || 'Unknown User',
                email: order.user?.email || 'Unknown Email',
            },
            shippingAddress: {
                name: order.shippingAddress.name,
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
            },
            paymentMethod: order.paymentMethod,
            items: itemsWithImages,
            totalPrice: order.totalPrice,
            status: order.status,
            cancellationReason: order.cancellationReason,
            createdAt: order.createdAt,
            returnRequest: order.returnRequest || null,
            appliedCoupon: order.appliedCoupon
                ? {
                      code: order.appliedCoupon.code || 'No Coupon',
                      discountAmount: order.appliedCoupon.discountAmount || 0,
                  }
                : null,
            invoiceNumber: `INV-${order.id.toString().slice(-6)}`,
            invoiceDate: new Date().toISOString().split('T')[0],
        };

        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${simplifiedOrder.invoiceNumber}.pdf`);

        // Create PDF document
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // Generate PDF content
        generateInvoicePDF(doc, simplifiedOrder);

        doc.end();
    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Helper function to generate PDF invoice
function generateInvoicePDF(doc, order) {
    // Add company logo and information
    doc.fontSize(20).text('FURNIQUE', { align: 'center' });
    doc.fontSize(10).text('Kakkanchery Kinfra technopark, Calicut, kerala, India', { align: 'center' });
    doc.text('support@furnique.com | +91 9895449488', { align: 'center' });
    doc.moveDown();

    // Add a horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Add invoice information
    doc.fontSize(16).text('INVOICE', { align: 'center', color:'green' });
    doc.moveDown();

    doc.fontSize(10).text(`Invoice Number: ${order.invoiceNumber}`, { align: 'right' });
    doc.text(`Invoice Date: ${order.invoiceDate}`, { align: 'right' });
    doc.text(`Order Date: ${new Date(order.createdAt).toISOString().split('T')[0]}`, { align: 'right' });
    doc.text(`Payment Method: ${order.paymentMethod}`, { align: 'right' });
    doc.moveDown();

    // Add customer information
    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(10).text(`Name: ${order.user.name}`);
    doc.text(`Email: ${order.user.email}`);
    doc.text('Shipping Address:');
    doc.text(`${order.shippingAddress.name}`);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`);
    doc.moveDown();

    // Add item table headers
    const tableTop = doc.y;
    let tablePosition = tableTop;

    doc.font('Helvetica-Bold');
    drawTableRow(doc, tablePosition, 'Product', 'Quantity', 'Price', 'Subtotal');
    tablePosition += 20;
    doc.font('Helvetica');

    // Add a horizontal line
    doc.moveTo(50, tablePosition - 5).lineTo(550, tablePosition - 5).stroke();

    // Add item rows
    let subtotal = 0;
    for (const item of order.items) {
        drawTableRow(
            doc,
            tablePosition,
            item.productName,
            item.quantity.toString(),
            `₹${item.price.toFixed(2)}`,
            `₹${(item.quantity * item.price).toFixed(2)}`
        );
        subtotal += item.quantity * item.price;
        tablePosition += 20;

        // Check if we need a new page
        if (tablePosition > 700) {
            doc.addPage();
            tablePosition = 50;
        }
    }

    // Add a horizontal line
    doc.moveTo(50, tablePosition).lineTo(550, tablePosition).stroke();
    tablePosition += 20;

    // Add totals
    const discountAmount = order.appliedCoupon ? order.appliedCoupon.discountAmount : 0;

    doc.text('Subtotal:', 350, tablePosition);
    doc.text(`₹${subtotal.toFixed(2)}`, 500, tablePosition, { align: 'right' });
    tablePosition += 20;

    if (discountAmount > 0) {
        doc.text(`Discount (${order.appliedCoupon.code}):`, 350, tablePosition);
        doc.text(`-₹${discountAmount.toFixed(2)}`, 500, tablePosition, { align: 'right' });
        tablePosition += 20;
    }

    doc.font('Helvetica-Bold');
    doc.text('Total:', 350, tablePosition);
    doc.text(`₹${order.totalPrice.toFixed(2)}`, 500, tablePosition, { align: 'right' });
    doc.font('Helvetica');

    // Add footer
    doc.fontSize(10).text('Thank you for your purchase!', 50, 700, { align: 'center' });
    doc.text('For questions or concerns, please contact support@yourcompany.com', { align: 'center' });
}

function drawTableRow(doc, y, product, quantity, price, total) {
    doc.text(product.substring(0, 25) + (product.length > 25 ? '...' : ''), 50, y, { width: 250 });
    doc.text(quantity, 310, y, { width: 50, align: 'center' });
    doc.text(price, 370, y, { width: 80, align: 'right' });
    doc.text(total, 460, y, { width: 80, align: 'right' });
}
// Cancel entire order
const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        
        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled.' });
        }
        
        // Update all items to cancelled
        order.items.forEach(item => {
            if (item.status !== 'delivered' && item.status !== 'cancelled') {
                item.status = 'cancelled';
            }
        });
        
        // Check if all items are now cancelled
        const allCancelled = order.items.every(item => item.status === 'cancelled');
        if (allCancelled) {
            order.status = 'cancelled';
        } else {
            order.status = 'partially_cancelled';
        }
        
        // Process refund if payment method is razorpay
        if (order.paymentMethod === 'razorpay') {
            const userId = order.user;
            let wallet = await Wallet.findOne({ user: userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    user: userId,
                    balance: 0,
                    transactions: [],
                });
            }
            
             // Calculate refund amount for cancelled items only
             const cancelledItemsTotalPrice = order.items
             .filter(item => item.status === 'cancelled')
             .reduce((total, item) => total + (item.price * item.quantity), 0);
         
         // Calculate proportional discount
         const orderTotalPrice = order.items.reduce((total, item) => total + (item.price * item.quantity), 0);
         const discountAmount = order.appliedCoupon?.discountAmount || 0;
         const proportionalDiscount = (cancelledItemsTotalPrice / orderTotalPrice) * discountAmount;
         
         // Adjust refund amount by deducting proportional discount
         const refundAmount = cancelledItemsTotalPrice - proportionalDiscount;
            
            if (refundAmount > 0) {
                wallet.balance += refundAmount;
                
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    orderId: order._id,
                    description: `Order Cancellation Refund: ${order._id}`,
                });
                
                await wallet.save();
            }
        }
        
        await order.save();
        
        return res.json({ 
            success: true, 
            message: 'Order cancelled successfully.',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// Cancel individual item
const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        // Find the specific item in the order
        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }
        
        const item = order.items[itemIndex];
        
        // Check if this item can be cancelled
        if (item.status === 'delivered' || item.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'This item cannot be cancelled' });
        }
        
        // Update the item status
        order.items[itemIndex].status = 'cancelled';
        
        // Check if all items are cancelled to update the overall order status
        const allItemsCancelled = order.items.every(item => item.status === 'cancelled');
        if (allItemsCancelled) {
            order.status = 'cancelled';
        } else {
            order.status = 'partially_cancelled';
        }
        
        await order.save();
        
        // Process refund if payment was made through Razorpay
        if (order.paymentMethod === 'razorpay') {
            const userId = order.user;
            let wallet = await Wallet.findOne({ user: userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    user: userId,
                    balance: 0,
                    transactions: [],
                });
            }
            
            
            // Calculate total price of the item being cancelled
            const itemTotalPrice = item.price * item.quantity;

            // Calculate the proportional discount
            const orderTotalPrice = order.items.reduce((total, currentItem) => total + (currentItem.price * currentItem.quantity), 0);
            const discountAmount = order.appliedCoupon?.discountAmount || 0;
            const proportionalDiscount = (itemTotalPrice / orderTotalPrice) * discountAmount;

            // Adjust refund amount by deducting proportional discount
            const refundAmount = itemTotalPrice - proportionalDiscount;
            
            wallet.balance += refundAmount;
            
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                orderId: order._id,
                itemId: item._id,
                description: `Item Refund: ${order._id} - ${item.productName}`,
            });
            
            await wallet.save();
        }
        
        res.status(200).json({
            success: true,
            message: 'Item cancelled successfully',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Error cancelling item:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID.' });
        }
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        
        // Don't allow status changes for special statuses
        if (order.status === 'delivered' || 
            order.status === 'cancelled' || 
            order.status === 'returned' || 
            order.status === 'partially_returned' ||
            order.status === 'partially_cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'The status of this order cannot be changed anymore.' 
            });
        }
        
        // Update all items and the main order status
        order.items.forEach(item => {
            if (item.status !== 'cancelled' && 
                item.status !== 'returned' && 
                item.status !== 'return_requested') {
                item.status = status.toLowerCase();
            }
        });
        
        order.status = status.toLowerCase();
        await order.save();
        
        return res.json({ success: true, message: 'Order status updated successfully.' });
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// Update individual item status
const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { status } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        // Find the specific item in the order
        const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in this order' });
        }
        
        const item = order.items[itemIndex];
        
        // Check if this item's status can be changed
        if (item.status === 'delivered' || 
            item.status === 'cancelled' || 
            item.status === 'returned') {
            return res.status(400).json({ 
                success: false, 
                message: 'This item\'s status cannot be changed anymore.' 
            });
        }
        
        // Update the item status
        order.items[itemIndex].status = status.toLowerCase();
        
        // Update order status based on items
        updateOrderStatusBasedOnItems(order);
        
        await order.save();
        
        res.status(200).json({
            success: true,
            message: 'Item status updated successfully',
            orderStatus: order.status
        });
    } catch (error) {
        console.error('Error updating item status:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Approve individual item return


// Helper function to update order status based on item statuses
function updateOrderStatusBasedOnItems(order) {
    const statuses = order.items.map(item => item.status);
    
    if (statuses.every(status => status === 'cancelled')) {
        order.status = 'cancelled';
    } else if (statuses.every(status => status === 'delivered')) {
        order.status = 'delivered';
    } else if (statuses.every(status => status === 'returned')) {
        order.status = 'returned';
    } else if (statuses.includes('cancelled')) {
        order.status = 'partially_cancelled';
    } else if (statuses.includes('returned') || statuses.includes('return_requested')) {
        order.status = 'partially_returned';
    } else if (statuses.includes('shipped')) {
        order.status = 'shipped';
    } else if (statuses.includes('processing')) {
        order.status = 'processing';
    } else {
        order.status = 'pending';
    }
}







// Submit Return Request for Entire Order
const submitEntireOrderReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason, additionalDetails } = req.body;

        console.log('Received request:', { orderId, reason, additionalDetails });

        // Validate input
        if (!reason) {
            console.error('Reason for return is missing');
            return res.status(400).json({ success: false, message: 'Reason for return is required' });
        }

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if any item is ineligible for return
        const ineligibleItems = order.items.filter(
            (item) => item.status === 'returned' || item.status === 'canceled'
        );
        if (ineligibleItems.length > 0) {
            console.error('Ineligible items found:', ineligibleItems);
            return res.status(400).json({
                success: false,
                message: 'Some items in this order cannot be returned',
            });
        }

        // Update all items to "return_requested"
        order.items.forEach((item) => {
            item.status = 'return_requested';
            item.returnRequest = {
                reason,
                additionalDetails: additionalDetails || '',
                requestedAt: new Date(),
            };
        });

        // Update the overall order status
        order.status = 'return_requested';

        // Save the updated order
        try {
            await order.save();
            console.log('Order saved successfully:', order._id);
        } catch (saveError) {
            console.error('Error saving order:', saveError.message);
            return res.status(500).json({ success: false, message: 'Failed to save order' });
        }

        // Return success response
        res.json({
            success: true,
            message: 'Return request for entire order submitted successfully',
            order,
        });
    } catch (error) {
        console.error('Error submitting return request for entire order:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Existing submitItemReturn function
const submitItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { reason, additionalDetails } = req.body;

        // Validate input
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Reason for return is required' });
        }

        // Find the order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Find the specific item in the order
        const item = order.items.id(itemId); // Use Mongoose's .id() method to find the item by its ID
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in the order' });
        }

        // Check if the item is eligible for return (e.g., not already returned or canceled)
        if (item.status === 'returned' || item.status === 'canceled') {
            return res.status(400).json({ success: false, message: 'This item cannot be returned' });
        }

        // Update the item's status and add return request details
        item.status = 'returned';
        item.returnRequest = {
            reason,
            additionalDetails: additionalDetails || '',
            requestedAt: new Date(),
        };

        // Save the updated order
        await order.save();

        // Return success response
        res.json({
            success: true,
            message: 'Return request submitted successfully',
            order,
        });
    } catch (error) {
        console.error('Error submitting return request:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
module.exports = {
    getOrderList,
    getOrderDetails,
    viewInvoice,
    downloadInvoice,
    cancelOrder,
    cancelOrderItem,
    updateOrderStatus,
    updateItemStatus,
    submitEntireOrderReturn,
    submitItemReturn,
  
};