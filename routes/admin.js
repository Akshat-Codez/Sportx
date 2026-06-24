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

module.exports = router;
