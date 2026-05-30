const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Serve static files so that index.html and admin.html can be accessed directly
app.use(express.static(__dirname));

// ── VERCEL COMPATIBLE IN-MEMORY DATABASE ──
// Since Vercel is serverless and ephemeral, SQLite's native C++ bindings often crash the function.
// Using pure JS arrays guarantees 100% uptime on Vercel for the prototype.

let products = [
  { id: 1, tag: "FIFA APPROVED", name: "Pro Football", price: 1499, rent: 39, icon: "⚽", filter: "balls", stock: 24 },
  { id: 2, tag: "LIGHTWEIGHT", name: "Yonex Nanoflare", price: 5699, rent: 125, icon: "🏸", filter: "rackets", stock: 8 },
  { id: 3, tag: "CLASSIC", name: "SS Kashmir Willow", price: 2999, rent: 85, icon: "🏏", filter: "sticks", stock: 15 },
  { id: 4, tag: "DURABLE", name: "Kookaburra Helmet", price: 1299, rent: 49, icon: "⛑️", filter: "helmets", stock: 20 },
  { id: 5, tag: "SPEED", name: "Nike Mercurial", price: 4999, rent: 190, icon: "👟", filter: "shoes", stock: 12 },
  { id: 6, tag: "PRO BUNDLE", name: "Full Cricket Kit", price: 12599, rent: 499, icon: "🏏", filter: "kits", stock: 5 },
  { id: 7, tag: "NBA GRADE", name: "NBA Spalding", price: 3999, rent: 99, icon: "🏀", filter: "balls", stock: 18 },
  { id: 8, tag: "TOUR", name: "Wilson Pro Staff", price: 18999, rent: 450, icon: "🎾", filter: "rackets", stock: 3 }
];

let cart = []; // { id, productId, type, qty, days }
let orders = []; // { id, total, createdAt, status, address, paymentMethod, phone, items: [] }
let cartIdCounter = 1;

/* ── ROUTES ── */

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/products', (req, res) => {
  let result = products;
  if (req.query.filter && req.query.filter !== 'all') {
    result = result.filter(p => p.filter === req.query.filter);
  }
  if (req.query.q) {
    result = result.filter(p => p.name.toLowerCase().includes(req.query.q.toLowerCase()));
  }
  res.json({ success: true, count: result.length, data: result });
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: product });
});

app.get('/api/cart', (req, res) => {
  let total = 0;
  const items = cart.map(c => {
    const p = products.find(p => p.id === c.productId);
    if (!p) return null;
    total += (c.type === 'buy' ? p.price * c.qty : p.rent * c.days * c.qty);
    return { ...c, name: p.name, price: p.price, rent: p.rent, icon: p.icon, filter: p.filter, product: p };
  }).filter(Boolean);
  
  res.json({ success: true, data: items, total });
});

app.post('/api/cart', (req, res) => {
  const { productId, type, qty = 1, days = 1 } = req.body;
  const p = products.find(p => p.id === parseInt(productId));
  if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
  
  const existing = cart.find(c => c.productId === parseInt(productId) && c.type === type);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: cartIdCounter++, productId: parseInt(productId), type, qty, days });
  }
  res.json({ success: true, message: 'Cart updated' });
});

app.delete('/api/cart/:id', (req, res) => {
  cart = cart.filter(c => c.id !== parseInt(req.params.id));
  res.json({ success: true, message: 'Removed' });
});

app.patch('/api/cart/:id/qty', (req, res) => {
  const { delta } = req.body;
  const item = cart.find(c => c.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(c => c.id !== item.id);
    return res.json({ success: true, remove: true });
  }
  res.json({ success: true, qty: item.qty });
});

app.post('/api/orders', (req, res) => {
  const { address = '', paymentMethod = 'COD', phone = '' } = req.body || {};
  if (cart.length === 0) return res.status(400).json({ success: false, message: 'Cart empty' });
  
  let total = 0;
  const orderItems = [];
  
  cart.forEach(c => {
    const p = products.find(p => p.id === c.productId);
    if (p) {
      const price = c.type === 'buy' ? p.price : p.rent * c.days;
      total += price * c.qty;
      orderItems.push({ productId: p.id, type: c.type, qty: c.qty, price });
    }
  });
  
  const orderId = `SX-${Date.now()}`;
  orders.unshift({
    id: orderId,
    total,
    createdAt: new Date().toISOString(),
    status: 'confirmed',
    address,
    paymentMethod,
    phone,
    items: orderItems
  });
  
  cart = []; // clear cart
  res.status(201).json({ success: true, message: 'Order placed', orderId });
});

app.get('/api/orders', (req, res) => {
  res.json({ success: true, count: orders.length, data: orders });
});

app.put('/api/products/:id/stock', (req, res) => {
  const { stock } = req.body;
  if (stock === undefined || stock === null) return res.status(400).json({ success: false, message: 'Stock value required' });
  if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) return res.status(400).json({ success: false, message: 'Stock must be a non-negative integer' });
  
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ success: false, message: 'Not found' });
  
  product.stock = stock;
  res.json({ success: true, message: 'Stock updated' });
});

app.get('/api/stats', (req, res) => {
  const totalProducts = products.length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const lowStock = products.filter(p => p.stock < 6).map(p => ({ name: p.name, stock: p.stock }));
  
  res.json({
    success: true,
    data: { totalProducts, totalOrders, totalRevenue, lowStock }
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`SportX API running on http://localhost:${PORT}`));
}
module.exports = app;