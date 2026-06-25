const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./lib/db');
const { requireAdminToken } = require('./utils/auth');

const Product = require('./models/Product');
const Order = require('./models/Order');

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

// Middleware to ensure database connection is ready for serverless requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ success: false, message: 'Database connection error: ' + err.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check and stats
app.get('/api/health', (_req, res) => res.json({ status:'ok', ts:new Date().toISOString() }));

app.get('/api/stats', requireAdminToken, async (_req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalSecurityDeposit = orders.reduce((sum, o) => sum + (o.securityDeposit || 0), 0);
    const actualRevenue = totalRevenue - totalSecurityDeposit;
    
    const lowStockProducts = await Product.find({ stock: { $lt: 6 } });
    
    res.json({
      success: true,
      data: {
        totalProducts,
        totalOrders,
        totalRevenue,
        actualRevenue,
        totalSecurityDeposit,
        lowStock: lowStockProducts.map(p => ({ name: p.name, stock: p.stock })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`\n🚀  SportX API → http://localhost:${PORT}\n`));
}
module.exports = app;