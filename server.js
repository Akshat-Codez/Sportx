const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const app     = express();
const PORT    = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─────────────────────────────────────────────────────────────
// CRYPTO HELPERS  (pure Node — no native addons, Vercel-safe)
// ─────────────────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(password, salt, 310000, 64, 'sha512').toString('hex');
  if (hash.length !== check.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// ── Minimal JWT (HS256, pure JS) ──
const JWT_SECRET = process.env.JWT_SECRET || 'sportx-dev-secret-change-in-prod';
function b64u(s) { return Buffer.from(s).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function signJWT(payload, ttl = 604800) {
  const h = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const b = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+ttl }));
  const s = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${h}.${b}.${s}`;
}
function verifyJWT(token) {
  try {
    const [h, b, s] = token.split('.');
    const exp = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    if (s !== exp) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    return p.exp < Math.floor(Date.now()/1000) ? null : p;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const tok = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!tok) return res.status(401).json({ success:false, message:'Unauthorised' });
  const p = verifyJWT(tok);
  if (!p) return res.status(401).json({ success:false, message:'Token invalid or expired' });
  req.userId = p.userId; req.userEmail = p.email; next();
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY STORE
// NOTE: On Vercel these reset on cold-start.  That is expected
// for a prototype.  For persistence use a real DB (Planetscale,
// Supabase, Upstash Redis — all have free tiers).
// ─────────────────────────────────────────────────────────────
let users   = [];
let cart    = [];
let orders  = [];
let cartIdx = 1;
// otpStore is intentionally NOT used for Vercel — OTP lives in
// a signed JWT returned to the client and echoed back on verify.
// This is stateless and works across serverless cold-starts.

let products = [
  { id:1, tag:"FIFA APPROVED", name:"Pro Football",      price:1499, rent:39,  icon:"<img src='https://tse1.mm.bing.net/th/id/OIP.O1PTKf1sohkHbWocvy082gHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3' style='height:100px;'>",  filter:"balls",   stock:24 },
  { id:2, tag:"LIGHTWEIGHT",   name:"Yonex Nanoflare",   price:2699, rent:125, icon:"<img src='https://m.media-amazon.com/images/I/61JZ9-KXGEL._AC_.jpg' style='height:100px;'>",                                          filter:"rackets", stock:8  },
  { id:3, tag:"CLASSIC",       name:"SS Kashmir Willow", price:3999, rent:105, icon:"<img src='https://nagrathsports.com/wp-content/uploads/2023/07/Super-Select-2-for-web-copy-scaled-1.jpg' style='height:100px;'>",      filter:"sticks",  stock:15 },
  { id:4, tag:"DURABLE",       name:"Kookaburra Helmet", price:1299, rent:49,  icon:"<img src='https://cdn.shopify.com/s/files/1/1348/4519/products/kookaburra-cricket-helmet-kb-pro-400-204024_1024x1024.jpg?v=1659218771' style='height:100px;'>", filter:"helmets", stock:20 },
  { id:5, tag:"SPEED",         name:"Nike Mercurial",    price:4999, rent:190, icon:"<img src='https://thumblr.uniid.it/product/408403/5d2f96677449.jpg?width=750&format=webp&q=75' style='height:100px;'>",                filter:"shoes",   stock:12 },
  { id:6, tag:"PRO BUNDLE",    name:"Full Cricket Kit",  price:8599, rent:499, icon:"<img src='https://m.media-amazon.com/images/I/71i6rvL0SaL._SL1200_.jpg' style='height:100px;'>",                                      filter:"kits",    stock:5  },
  { id:7, tag:"NBA GRADE",     name:"NBA Spalding",      price:3999, rent:99,  icon:"<img src='https://s.yimg.com/ny/api/res/1.2/3oRP_eLdK8lySncePuZCGw--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD04MDA-/https://s.yimg.com/os/creatr-images/2020-05/b9b27b40-9547-11ea-b5fb-0e86f7a8e4ad' style='height:100px;'>", filter:"balls",   stock:18 },
  { id:8, tag:"TOUR",          name:"Wilson Pro Staff",  price:9999, rent:550, icon:"<img src='https://tse4.mm.bing.net/th/id/OIP.mSSLeWlmAUk2978hlIUfJAHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3' style='height:100px;'>",    filter:"rackets", stock:3  }
];

// ─────────────────────────────────────────────────────────────
// OTP — NO EMAIL.  OTP is:
//   • Printed to console  (visible in Vercel Function logs)
//   • Returned in API response as `otp` field
//   • Embedded in a signed pendingToken so verify works
//     even after a cold-start wipes in-memory store
// ─────────────────────────────────────────────────────────────
function generateOTP() { return crypto.randomInt(100000, 999999).toString(); }

function sendOTP(email, otp, purpose) {
  // Always print — visible in Vercel → Project → Functions → Logs
  console.log('\n╔══════════════════════════════════╗');
  console.log(`║  SPORTX OTP  [${purpose.toUpperCase().padEnd(10)}]        ║`);
  console.log(`║  Email : ${email.substring(0,24).padEnd(24)} ║`);
  console.log(`║  OTP   : ${otp}                   ║`);
  console.log('╚══════════════════════════════════╝\n');
}

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────
function isEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).toLowerCase()); }
function pwStrength(p) {
  if (!p || p.length < 8)       return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(p))          return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(p))          return 'Password must contain a lowercase letter';
  if (!/\d/.test(p))             return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(p))  return 'Password must contain a special character';
  return null;
}

// ─────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────

// POST /api/auth/register  →  sends OTP, returns it in response
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name)
    return res.status(400).json({ success:false, message:'name, email and password are required' });
  if (!isEmail(email))
    return res.status(400).json({ success:false, message:'Invalid email address' });
  const pwErr = pwStrength(password);
  if (pwErr) return res.status(400).json({ success:false, message:pwErr });
  if (users.find(u => u.email === email.toLowerCase()))
    return res.status(409).json({ success:false, message:'Email already registered' });

  const otp = generateOTP();
  const pendingUser = { email:email.toLowerCase(), passwordHash:hashPassword(password), name, phone:req.body.phone||'', address:req.body.address||'' };
  // Embed OTP + pendingUser inside a signed JWT (10-min TTL)
  const pendingToken = signJWT({ otp, purpose:'signup', pendingUser }, 600);

  sendOTP(email, otp, 'signup');

  res.json({
    success: true,
    message: 'OTP generated — check Vercel Function Logs, or read it from the `otp` field below.',
    otp,           // ← returned directly so you never need email
    pendingToken   // ← stateless OTP store, works across cold-starts
  });
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp, pendingToken } = req.body || {};
  if (!email || !otp) return res.status(400).json({ success:false, message:'email and otp are required' });

  if (!pendingToken)
    return res.status(400).json({ success:false, message:'pendingToken missing — please register again' });

  const decoded = verifyJWT(pendingToken);
  if (!decoded)
    return res.status(400).json({ success:false, message:'OTP session expired (10 min). Please register again.' });

  if (decoded.otp !== String(otp).trim())
    return res.status(400).json({ success:false, message:'Incorrect OTP. Please try again.' });

  if (decoded.purpose === 'signup') {
    const { pendingUser } = decoded;
    if (users.find(u => u.email === pendingUser.email))
      return res.status(409).json({ success:false, message:'Already registered. Please sign in.' });
    const userId = `usr_${Date.now()}`;
    users.push({ id:userId, ...pendingUser, emailVerified:true, createdAt:new Date().toISOString() });
    const token = signJWT({ userId, email:pendingUser.email });
    return res.json({ success:true, message:'Account created!', token, userId, name:pendingUser.name, email:pendingUser.email });
  }

  if (decoded.purpose === 'login-otp') {
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    const token = signJWT({ userId:user.id, email:user.email });
    return res.json({ success:true, message:'Logged in!', token, userId:user.id, name:user.name, email:user.email });
  }

  if (decoded.purpose === 'reset') {
    const resetToken = signJWT({ email:email.toLowerCase(), purpose:'reset' }, 900);
    return res.json({ success:true, message:'OTP verified', resetToken });
  }

  res.status(400).json({ success:false, message:'Unknown purpose' });
});

// POST /api/auth/login  (password)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success:false, message:'email and password are required' });
  const user  = users.find(u => u.email === email.toLowerCase());
  const dummy = `${'0'.repeat(64)}:${'0'.repeat(128)}`;
  const ok    = user ? verifyPassword(password, user.passwordHash) : (verifyPassword('x', dummy), false);
  if (!user || !ok) return res.status(401).json({ success:false, message:'Invalid email or password' });
  const token = signJWT({ userId:user.id, email:user.email });
  res.json({ success:true, token, userId:user.id, name:user.name, email:user.email });
});

// POST /api/auth/request-otp  (login-otp / reset)
app.post('/api/auth/request-otp', (req, res) => {
  const { email, purpose = 'login-otp' } = req.body || {};
  if (!email) return res.status(400).json({ success:false, message:'email required' });
  if (purpose === 'login-otp') {
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(404).json({ success:false, message:'No account with that email' });
  }
  const otp = generateOTP();
  const pendingToken = signJWT({ otp, purpose, email:email.toLowerCase() }, 600);
  sendOTP(email, otp, purpose);
  res.json({ success:true, message:'OTP generated.', otp, pendingToken });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ success:false, message:'User not found' });
  const { passwordHash, ...safe } = user;
  res.json({ success:true, data:safe });
});

// ─────────────────────────────────────────────────────────────
// PRODUCT ROUTES
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status:'ok', ts:new Date().toISOString() }));

app.get('/api/products', (req, res) => {
  let r = products;
  if (req.query.filter && req.query.filter !== 'all') r = r.filter(p => p.filter === req.query.filter);
  if (req.query.q) r = r.filter(p => p.name.toLowerCase().includes(req.query.q.toLowerCase()));
  res.json({ success:true, count:r.length, data:r });
});

app.get('/api/products/:id', (req, res) => {
  const p = products.find(p => p.id === +req.params.id);
  if (!p) return res.status(404).json({ success:false, message:'Not found' });
  res.json({ success:true, data:p });
});

app.put('/api/products/:id/stock', (req, res) => {
  const { stock } = req.body;
  if (stock == null || typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))
    return res.status(400).json({ success:false, message:'stock must be a non-negative integer' });
  const p = products.find(p => p.id === +req.params.id);
  if (!p) return res.status(404).json({ success:false, message:'Not found' });
  p.stock = stock;
  res.json({ success:true, message:'Stock updated' });
});

// ─────────────────────────────────────────────────────────────
// CART ROUTES
// ─────────────────────────────────────────────────────────────
app.get('/api/cart', (_req, res) => {
  let total = 0;
  const items = cart.map(c => {
    const p = products.find(p => p.id === c.productId);
    if (!p) return null;
    total += c.type === 'buy' ? p.price * c.qty : p.rent * c.days * c.qty;
    return { ...c, name:p.name, price:p.price, rent:p.rent, icon:p.icon, filter:p.filter, product:p };
  }).filter(Boolean);
  res.json({ success:true, data:items, total });
});

app.post('/api/cart', (req, res) => {
  const { productId, type, qty=1, days=1 } = req.body;
  const p = products.find(p => p.id === +productId);
  if (!p) return res.status(404).json({ success:false, message:'Product not found' });
  const ex = cart.find(c => c.productId === +productId && c.type === type);
  if (ex) { ex.qty += qty; } else { cart.push({ id:cartIdx++, productId:+productId, type, qty, days }); }
  res.json({ success:true, message:'Cart updated' });
});

app.delete('/api/cart/:id', (req, res) => {
  cart = cart.filter(c => c.id !== +req.params.id);
  res.json({ success:true });
});

app.patch('/api/cart/:id/qty', (req, res) => {
  const { delta } = req.body;
  const item = cart.find(c => c.id === +req.params.id);
  if (!item) return res.status(404).json({ success:false, message:'Item not found' });
  item.qty += delta;
  if (item.qty <= 0) { cart = cart.filter(c => c.id !== item.id); return res.json({ success:true, remove:true }); }
  res.json({ success:true, qty:item.qty });
});

// ─────────────────────────────────────────────────────────────
// ORDER ROUTES
// ─────────────────────────────────────────────────────────────
app.post('/api/orders', (req, res) => {
  const { address='', paymentMethod='COD', phone='' } = req.body || {};
  if (!cart.length) return res.status(400).json({ success:false, message:'Cart empty' });
  let total = 0; let hasRental = false; const items = [];
  cart.forEach(c => {
    const p = products.find(p => p.id === c.productId);
    if (!p) return;
    const price = c.type === 'buy' ? p.price : p.rent * c.days;
    total += price * c.qty;
    items.push({ productId:p.id, name:p.name, type:c.type, qty:c.qty, price });
    if (c.type === 'rent') hasRental = true;
  });
  const deposit = hasRental ? 499 : 0;
  total += deposit;
  const orderId = `SX-${Date.now()}`;
  orders.unshift({ id:orderId, total, securityDeposit:deposit, createdAt:new Date().toISOString(), status:'confirmed', address, paymentMethod, phone, items });
  cart = [];
  res.status(201).json({ success:true, message:'Order placed', orderId, securityDeposit:deposit });
});

app.get('/api/orders', (_req, res) => res.json({ success:true, count:orders.length, data:orders }));

// ─────────────────────────────────────────────────────────────
// STATS (admin)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  res.json({ success:true, data:{
    totalProducts : products.length,
    totalOrders   : orders.length,
    totalRevenue  : orders.reduce((s,o) => s+o.total, 0),
    lowStock      : products.filter(p => p.stock < 6).map(p => ({ name:p.name, stock:p.stock }))
  }});
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`\n🚀  SportX API → http://localhost:${PORT}\n`));
}
module.exports = app;