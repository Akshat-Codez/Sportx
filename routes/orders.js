const express = require('express');
const Order = require('../models/Order');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const { requireAuth } = require('../utils/auth');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { address = '', paymentMethod = 'COD', phone = '' } = req.body || {};

    const userCart = await CartItem.find({ userId: req.userId });
    if (!userCart.length) {
      return res.status(400).json({ success: false, message: 'Cart empty' });
    }

    let total = 0;
    let hasRental = false;
    const items = [];

    for (const c of userCart) {
      const p = await Product.findOne({ id: c.productId });
      if (!p) continue;

      const linePrice = c.type === 'buy' ? p.price : p.rent * c.days;
      total += linePrice * c.qty;
      items.push({ productId: p.id, name: p.name, type: c.type, qty: c.qty, price: linePrice, days: c.days });

      if (c.type === 'rent') hasRental = true;

      if (p.stock >= c.qty) {
        p.stock -= c.qty;
      } else {
        p.stock = 0;
      }
      await p.save();
    }

    const deposit = hasRental ? 499 : 0;
    total += deposit;

    const orderId = `SX-${Date.now()}`;

    const newOrder = await Order.create({
      id: orderId,
      userId: req.userId,
      total,
      securityDeposit: deposit,
      address,
      paymentMethod,
      phone,
      items,
      status: 'confirmed'
    });

    await CartItem.deleteMany({ userId: req.userId });

    res.status(201).json({
      success: true,
      message: 'Order placed',
      orderId,
      securityDeposit: deposit,
      total,
      items
    });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const userOrders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, count: userOrders.length, data: userOrders });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const userOrders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, count: userOrders.length, data: userOrders });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
