const express = require('express');
const cors = require('cors');
const path = require('path');
const { init, store } = require('./store');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Static files are served by Vercel CDN (not Express) in production
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(__dirname));
}

// Initialize data store
init();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check and stats
app.get('/api/health', (_req, res) => res.json({ status:'ok', ts:new Date().toISOString() }));

app.get('/api/stats', (_req, res) => {
  const totalRevenue = store.orders.reduce((sum, o) => sum + (o.total || 0), 0);
  res.json({
    success: true,
    data: {
      totalProducts : store.products.length,
      totalOrders   : store.orders.length,
      totalRevenue,
      lowStock      : store.products
        .filter(p => p.stock < 6)
        .map(p => ({ name: p.name, stock: p.stock })),
    },
  });
});

// 404 Handler
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.status(404).sendFile(path.join(__dirname, '404.html'));
  }
  res.status(404).json({ success: false, message: 'Not found' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`\n🚀  SportX API → http://localhost:${PORT}\n`));
}
module.exports = app;