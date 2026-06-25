const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.query.filter && req.query.filter !== 'all') {
      query.filter = req.query.filter;
    }
    if (req.query.q) {
      query.name = { $regex: req.query.q, $options: 'i' };
    }
    const products = await Product.find(query);
    res.json({ success:true, count:products.length, data:products });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const p = await Product.findOne({ id: +req.params.id });
    if (!p) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, data:p });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.put('/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock == null || typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))
      return res.status(400).json({ success:false, message:'stock must be a non-negative integer' });
    
    const p = await Product.findOneAndUpdate({ id: +req.params.id }, { stock }, { new: true });
    if (!p) return res.status(404).json({ success:false, message:'Not found' });
    
    res.json({ success:true, message:'Stock updated', data: p });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
