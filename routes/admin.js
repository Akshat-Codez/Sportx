const express = require('express');
const { store } = require('../store');

const router = express.Router();

router.get('/orders', (_req, res) => {
  res.json({ success: true, count: store.orders.length, data: store.orders });
});

router.get('/otp-log', (_req, res) => {
  res.json({ success: true, data: store.otpActivityLog });
});

router.get('/users', (_req, res) => {
  const safe = store.users.map(({ passwordHash, ...u }) => u);
  res.json({ success: true, count: safe.length, data: safe });
});

// GET /api/admin/revenue-trend
// Returns daily revenue for the last 7 days for the dashboard chart
router.get('/revenue-trend', (_req, res) => {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }
  const trend = days.map(day => {
    const dayRevenue = store.orders
      .filter(o => o.createdAt && o.createdAt.startsWith(day))
      .reduce((sum, o) => sum + (o.total || 0), 0);
    return { date: day, revenue: dayRevenue };
  });
  res.json({ success: true, data: trend });
});

// PUT /api/admin/order-status/:id
// Change the status of an order (e.g., 'cancelled', 'delivered', 'transit')
router.put('/order-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ success: false, message: 'Status required' });

  const { store, saveData } = require('../store');
  const order = store.orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  order.status = status;
  // If cancelled, optionally restore stock
  if (status === 'cancelled') {
    (order.items || []).forEach(it => {
      const p = store.products.find(p => p.id === it.productId);
      if (p) p.stock += it.qty;
    });
  }
  
  saveData();
  res.json({ success: true, message: 'Order status updated', order });
});

module.exports = router;
