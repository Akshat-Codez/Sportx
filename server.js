const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Serve static files so that index.html and admin.html can be accessed directly
app.use(express.static(__dirname));

const db = new sqlite3.Database(path.join(__dirname, 'sportx.db'), (err) => {
  if (err) console.error('Database opening error: ', err);
});

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT, name TEXT, price REAL, rent REAL, icon TEXT, filter TEXT, stock INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER, type TEXT, qty INTEGER, days INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    total REAL, createdAt TEXT, status TEXT, address TEXT, paymentMethod TEXT, phone TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId TEXT, productId INTEGER, type TEXT, qty INTEGER, price REAL
  )`);
  
  // Seed products if empty
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare("INSERT INTO products (tag, name, price, rent, icon, filter, stock) VALUES (?,?,?,?,?,?,?)");
      const initialProducts = [
        ["FIFA APPROVED", "Pro Football", 1499, 39, "⚽", "balls", 24],
        ["LIGHTWEIGHT", "Yonex Nanoflare", 5699, 125, "🏸", "rackets", 8],
        ["CLASSIC", "SS Kashmir Willow", 2999, 85, "🏏", "sticks", 15],
        ["DURABLE", "Kookaburra Helmet", 1299, 49, "⛑️", "helmets", 20],
        ["SPEED", "Nike Mercurial", 4999, 190, "👟", "shoes", 12],
        ["PRO BUNDLE", "Full Cricket Kit", 12599, 499, "🏏", "kits", 5],
        ["NBA GRADE", "NBA Spalding", 3999, 99, "🏀", "balls", 18],
        ["TOUR", "Wilson Pro Staff", 18999, 450, "🎾", "rackets", 3]
      ];
      initialProducts.forEach(p => stmt.run(p));
      stmt.finalize();
    }
  });
});

/* ── ROUTES ── */

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/products', (req, res) => {
  let query = "SELECT * FROM products WHERE 1=1";
  let params = [];
  if (req.query.filter && req.query.filter !== 'all') {
    query += " AND filter = ?";
    params.push(req.query.filter);
  }
  if (req.query.q) {
    query += " AND name LIKE ?";
    params.push('%' + req.query.q + '%');
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, count: rows.length, data: rows });
  });
});

app.get('/api/products/:id', (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: row });
  });
});

app.get('/api/cart', (req, res) => {
  db.all(`
    SELECT c.*, p.name, p.price, p.rent, p.icon, p.filter
    FROM cart c JOIN products p ON c.productId = p.id
  `, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    let total = 0;
    rows.forEach(item => {
      total += (item.type === 'buy' ? item.price * item.qty : item.rent * item.days * item.qty);
      item.product = { name: item.name, price: item.price, rent: item.rent, icon: item.icon, filter: item.filter };
    });
    res.json({ success: true, data: rows, total });
  });
});

app.post('/api/cart', (req, res) => {
  const { productId, type, qty = 1, days = 1 } = req.body;
  db.get("SELECT * FROM products WHERE id = ?", [productId], (err, product) => {
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    db.get("SELECT * FROM cart WHERE productId = ? AND type = ?", [productId, type], (err, existing) => {
      if (existing) {
        db.run("UPDATE cart SET qty = qty + ? WHERE id = ?", [qty, existing.id], (err) => {
          res.json({ success: true, message: 'Cart updated' });
        });
      } else {
        db.run("INSERT INTO cart (productId, type, qty, days) VALUES (?,?,?,?)", [productId, type, qty, days], (err) => {
          res.json({ success: true, message: 'Added to cart' });
        });
      }
    });
  });
});

app.delete('/api/cart/:id', (req, res) => {
  db.run("DELETE FROM cart WHERE id = ?", [req.params.id], (err) => {
    res.json({ success: true, message: 'Removed' });
  });
});

app.post('/api/orders', (req, res) => {
  const { address = '', paymentMethod = 'COD', phone = '' } = req.body || {};
  db.all(`SELECT c.*, p.price, p.rent FROM cart c JOIN products p ON c.productId = p.id`, (err, items) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'Cart empty' });
    let total = 0;
    items.forEach(i => total += (i.type === 'buy' ? i.price * i.qty : i.rent * i.days * i.qty));
    
    const orderId = `SX-${Date.now()}`;
    db.run("INSERT INTO orders (id, total, createdAt, status, address, paymentMethod, phone) VALUES (?,?,?,?,?,?,?)", 
      [orderId, total, new Date().toISOString(), 'confirmed', address, paymentMethod, phone], (err) => {
        const stmt = db.prepare("INSERT INTO order_items (orderId, productId, type, qty, price) VALUES (?,?,?,?,?)");
        items.forEach(i => {
          const price = i.type === 'buy' ? i.price : i.rent * i.days;
          stmt.run([orderId, i.productId, i.type, i.qty, price]);
        });
        stmt.finalize();
        db.run("DELETE FROM cart", () => {
          res.status(201).json({ success: true, message: 'Order placed', orderId });
        });
    });
  });
});

app.get('/api/orders', (req, res) => {
  db.all("SELECT * FROM orders ORDER BY createdAt DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, count: rows.length, data: rows });
  });
});

app.put('/api/products/:id/stock', (req, res) => {
  const { stock } = req.body;
  if (stock === undefined) return res.status(400).json({ success: false, message: 'Stock value required' });
  
  db.run("UPDATE products SET stock = ? WHERE id = ?", [stock, req.params.id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: 'Stock updated', changes: this.changes });
  });
});

app.get('/api/stats', (req, res) => {
  db.get("SELECT COUNT(*) as products FROM products", (err, pRow) => {
    db.get("SELECT COUNT(*) as orders, SUM(total) as revenue FROM orders", (err, oRow) => {
      db.all("SELECT name, stock FROM products WHERE stock < 6", (err, lowStock) => {
        res.json({
          success: true,
          data: {
            totalProducts: pRow.products,
            totalOrders: oRow.orders,
            totalRevenue: oRow.revenue || 0,
            lowStock: lowStock
          }
        });
      });
    });
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`SportX API running on http://localhost:${PORT}`));
}
module.exports = app;
