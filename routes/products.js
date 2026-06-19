const express = require('express');
const { store, saveData } = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  let r = store.products;
  if (req.query.filter && req.query.filter !== 'all') r = r.filter(p => p.filter === req.query.filter);
  if (req.query.q) r = r.filter(p => p.name.toLowerCase().includes(req.query.q.toLowerCase()));
  res.json({ success:true, count:r.length, data:r });
});

router.get('/:id', (req, res) => {
  const p = store.products.find(p => p.id === +req.params.id);
  if (!p) return res.status(404).json({ success:false, message:'Not found' });
  res.json({ success:true, data:p });
});

router.put('/:id/stock', (req, res) => {
  const { stock } = req.body;
  if (stock == null || typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))
    return res.status(400).json({ success:false, message:'stock must be a non-negative integer' });
  const p = store.products.find(p => p.id === +req.params.id);
  if (!p) return res.status(404).json({ success:false, message:'Not found' });
  p.stock = stock;
  saveData();
  res.json({ success:true, message:'Stock updated' });
});

module.exports = router;
