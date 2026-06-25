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
app.use(express.static(__dirname));

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

// ─── Clean URL Routes ─────────────────────────────────────
// Maps friendly paths to HTML files so no .html extension needed.
const PAGES = {
  '/store'     : 'index.html',
  '/login'     : 'auth.html',
  '/signin'    : 'auth.html',
  '/register'  : 'auth.html',
  '/admin'     : 'admin.html',
  '/dashboard' : 'user-dashboard.html',
  '/account'   : 'user-dashboard.html',
  '/contact'   : 'contact.html',
};

Object.entries(PAGES).forEach(([route, file]) => {
  app.get(route, (_req, res) =>
    res.sendFile(path.join(__dirname, file))
  );
});

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`\n🚀  SportX API → http://localhost:${PORT}\n`));
}
module.exports = app;