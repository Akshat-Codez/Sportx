const express = require('express');
const { store, saveData } = require('../store');
const { requireAuth } = require('../utils/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  let total = 0;
  let hasRental = false;
  const userCart = store.cart.filter(c => c.userId === req.userId);
  const items = userCart.map(c => {
    const p = store.products.find(p => p.id === c.productId);
    if (!p) return null;
    if (c.type === 'rent') hasRental = true;
    total += c.type === 'buy' ? p.price * c.qty : p.rent * c.days * c.qty;
    return { ...c, name:p.name, price:p.price, rent:p.rent, icon:p.icon, filter:p.filter, product:p };
  }).filter(Boolean);
  const deposit = hasRental ? 499 : 0;
  total += deposit;
  res.json({ success:true, data:items, total, securityDeposit: deposit });
});

router.post('/', requireAuth, (req, res) => {
  const { productId, type, qty=1, days=1 } = req.body;
  const p = store.products.find(p => p.id === +productId);
  if (!p) return res.status(404).json({ success:false, message:'Product not found' });
  const ex = store.cart.find(c => c.productId === +productId && c.type === type && c.userId === req.userId);
  if (ex) { 
    ex.qty += qty; 
  } else { 
    store.cart.push({ id:store.cartIdx++, userId:req.userId, productId:+productId, type, qty, days }); 
  }
  saveData();
  res.json({ success:true, message:'Cart updated' });
});

router.delete('/:id', requireAuth, (req, res) => {
  store.cart = store.cart.filter(c => !(c.id === +req.params.id && c.userId === req.userId));
  saveData();
  res.json({ success:true });
});

router.patch('/:id/qty', requireAuth, (req, res) => {
  const { delta } = req.body;
  const item = store.cart.find(c => c.id === +req.params.id && c.userId === req.userId);
  if (!item) return res.status(404).json({ success:false, message:'Item not found' });
  item.qty += delta;
  if (item.qty <= 0) { 
    store.cart = store.cart.filter(c => c.id !== item.id); 
    saveData(); 
    return res.json({ success:true, remove:true }); 
  }
  saveData();
  res.json({ success:true, qty:item.qty });
});

module.exports = router;
