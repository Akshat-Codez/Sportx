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

module.exports = router;
