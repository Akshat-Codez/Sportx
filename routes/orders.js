const express = require('express');
const { store, saveData } = require('../store');
const { requireAuth } = require('../utils/auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const { address = '', paymentMethod = 'COD', phone = '' } = req.body || {};

  const userCart = store.cart.filter(c => c.userId === req.userId);
  if (!userCart.length) {
    return res.status(400).json({ success: false, message: 'Cart empty' });
  }

  let total     = 0;
  let hasRental = false;
  const items   = [];

  userCart.forEach(c => {
    const p = store.products.find(p => p.id === c.productId);
    if (!p) return;

    const linePrice = c.type === 'buy' ? p.price : p.rent * c.days;
    total += linePrice * c.qty;
    items.push({ productId: p.id, name: p.name, type: c.type, qty: c.qty, price: linePrice });

    if (c.type === 'rent') hasRental = true;

    if (p.stock >= c.qty) {
      p.stock -= c.qty;
    } else {
      p.stock = 0;
    }
  });

  const deposit = hasRental ? 499 : 0;
  total += deposit;

  const orderId = `SX-${Date.now()}`;

  store.orders.unshift({
    id              : orderId,
    userId          : req.userId,
    total,
    securityDeposit : deposit,
    createdAt       : new Date().toISOString(),
    status          : 'confirmed',
    address,
    paymentMethod,
    phone,
    items,
  });

  store.cart = store.cart.filter(c => c.userId !== req.userId);

  saveData();

  res.status(201).json({
    success         : true,
    message         : 'Order placed',
    orderId,
    securityDeposit : deposit,
    total,
    items,
  });
});

router.get('/', requireAuth, (req, res) => {
  const userOrders = store.orders.filter(o => o.userId === req.userId);
  res.json({ success: true, count: userOrders.length, data: userOrders });
});

module.exports = router;
