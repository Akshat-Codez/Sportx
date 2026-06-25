const express = require('express');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const { requireAuth } = require('../utils/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userCart = await CartItem.find({ userId: req.userId });
    
    let total = 0;
    let hasRental = false;
    const items = [];
    
    for (const c of userCart) {
      const p = await Product.findOne({ id: c.productId });
      if (!p) continue;
      
      if (c.type === 'rent') hasRental = true;
      total += c.type === 'buy' ? p.price * c.qty : p.rent * c.days * c.qty;
      items.push({ ...c.toObject(), name:p.name, price:p.price, rent:p.rent, icon:p.icon, filter:p.filter, product:p });
    }
    
    const deposit = hasRental ? 499 : 0;
    total += deposit;
    res.json({ success:true, data:items, total, securityDeposit: deposit });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { productId, type, qty=1, days=1 } = req.body;
    const p = await Product.findOne({ id: +productId });
    if (!p) return res.status(404).json({ success:false, message:'Product not found' });
    
    const ex = await CartItem.findOne({ productId: +productId, type, userId: req.userId });
    if (ex) { 
      ex.qty += qty; 
      await ex.save();
    } else { 
      const newId = Date.now(); 
      await CartItem.create({ id: newId, userId: req.userId, productId: +productId, type, qty, days }); 
    }
    res.json({ success:true, message:'Cart updated' });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await CartItem.deleteOne({ id: +req.params.id, userId: req.userId });
    res.json({ success:true });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.patch('/:id/qty', requireAuth, async (req, res) => {
  try {
    const { delta } = req.body;
    const item = await CartItem.findOne({ id: +req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ success:false, message:'Item not found' });
    
    item.qty += delta;
    if (item.qty <= 0) { 
      await CartItem.deleteOne({ _id: item._id });
      return res.json({ success:true, remove:true }); 
    }
    await item.save();
    res.json({ success:true, qty:item.qty });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
