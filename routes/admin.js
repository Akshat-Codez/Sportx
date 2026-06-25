const express = require('express');
const Order = require('../models/Order');
const OtpLog = require('../models/OtpLog');
const User = require('../models/User');
const Product = require('../models/Product');

const router = express.Router();

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/otp-log', async (req, res) => {
  try {
    const logs = await OtpLog.find().sort({ time: -1 }).limit(200);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/revenue-trend', async (req, res) => {
  try {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
    
    // Fetch all orders from the last 7 days
    const startDate = new Date(days[0]);
    const orders = await Order.find({ createdAt: { $gte: startDate } });
    
    const trend = days.map(day => {
      const dayRevenue = orders
        .filter(o => o.createdAt && o.createdAt.toISOString().startsWith(day))
        .reduce((sum, o) => sum + (o.total || 0), 0);
      return { date: day, revenue: dayRevenue };
    });
    res.json({ success: true, data: trend });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.put('/order-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status required' });

    const order = await Order.findOne({ id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status;
    
    if (status === 'cancelled') {
      for (const it of order.items || []) {
        const p = await Product.findOne({ id: it.productId });
        if (p) {
          p.stock += it.qty;
          await p.save();
        }
      }
    }
    
    await order.save();
    res.json({ success: true, message: 'Order status updated', order });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
