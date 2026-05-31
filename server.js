require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─────────────────────────────────────────────────────────────
// SECURITY UTILITIES
// ─────────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 310000, 64, 'sha512').toString('hex');
  if (hash.length !== verifyHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJWT(payload, expiresInSeconds = 3600 * 24 * 7) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorised' });
  const payload = verifyJWT(token);
  if (!payload) return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  req.userId = payload.userId;
  req.userEmail = payload.email;
  next();
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY STORES
// ─────────────────────────────────────────────────────────────

let users = [];
const otpStore = {};

let products = [
  { id: 1, tag: "FIFA APPROVED",  name: "Pro Football",       price: 1499, rent: 39,  icon: "<img src='https://tse1.mm.bing.net/th/id/OIP.O1PTKf1sohkHbWocvy082gHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3' style='height:100px;'>",  filter: "balls",   stock: 24 },
  { id: 2, tag: "LIGHTWEIGHT",   name: "Yonex Nanoflare",    price: 2699, rent: 125, icon: "<img src='https://m.media-amazon.com/images/I/61JZ9-KXGEL._AC_.jpg' style='height:100px;'>",                                            filter: "rackets", stock: 8  },
  { id: 3, tag: "CLASSIC",       name: "SS Kashmir Willow",  price: 3999, rent: 105, icon: "<img src='https://nagrathsports.com/wp-content/uploads/2023/07/Super-Select-2-for-web-copy-scaled-1.jpg' style='height:100px;'>",        filter: "sticks",  stock: 15 },
  { id: 4, tag: "DURABLE",       name: "Kookaburra Helmet",  price: 1299, rent: 49,  icon: "<img src='https://cdn.shopify.com/s/files/1/1348/4519/products/kookaburra-cricket-helmet-kb-pro-400-204024_1024x1024.jpg?v=1659218771' style='height:100px;'>", filter: "helmets", stock: 20 },
  { id: 5, tag: "SPEED",         name: "Nike Mercurial",     price: 4999, rent: 190, icon: "<img src='https://thumblr.uniid.it/product/408403/5d2f96677449.jpg?width=750&format=webp&q=75' style='height:100px;'>",                  filter: "shoes",   stock: 12 },
  { id: 6, tag: "PRO BUNDLE",    name: "Full Cricket Kit",   price: 8599, rent: 499, icon: "<img src='https://m.media-amazon.com/images/I/71i6rvL0SaL._SL1200_.jpg' style='height:100px;'>",                                        filter: "kits",    stock: 5  },
  { id: 7, tag: "NBA GRADE",     name: "NBA Spalding",       price: 3999, rent: 99,  icon: "<img src='https://s.yimg.com/ny/api/res/1.2/3oRP_eLdK8lySncePuZCGw--/YXBwaWQ9aGlnaGxhbmRlcjt3PTEyMDA7aD04MDA-/https://s.yimg.com/os/creatr-images/2020-05/b9b27b40-9547-11ea-b5fb-0e86f7a8e4ad' style='height:100px;'>", filter: "balls",   stock: 18 },
  { id: 8, tag: "TOUR",          name: "Wilson Pro Staff",   price: 9999, rent: 550, icon: "<img src='https://tse4.mm.bing.net/th/id/OIP.mSSLeWlmAUk2978hlIUfJAHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3' style='height:100px;'>",      filter: "rackets", stock: 3  }
];

let cart = [];
let orders = [];
let cartIdCounter = 1;

// ─────────────────────────────────────────────────────────────
// EMAIL — three-tier delivery:
//   1. Resend (RESEND_API_KEY) — recommended for Vercel
//   2. Gmail SMTP (SMTP_HOST + SMTP_USER + SMTP_PASS)
//   3. Console fallback — prints OTP in Vercel Function logs
//
// HOW TO SET UP RESEND (free, 3000 emails/month):
//   a) Go to https://resend.com → sign up → API Keys → Create Key
//   b) In Vercel dashboard → your project → Settings → Environment Variables
//      Add:  RESEND_API_KEY = re_xxxxxxxxxxxx
//            RESEND_FROM    = onboarding@resend.dev   ← works without domain verification
// ─────────────────────────────────────────────────────────────

async function sendViaResend(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM || 'SportX <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Email sent via Resend to ${to} (id: ${data.id})`);
      return true;
    }
    console.error('❌ Resend error:', JSON.stringify(data));
    return false;
  } catch (err) {
    console.error('❌ Resend fetch failed:', err.message);
    return false;
  }
}

async function sendViaGmail(to, subject, html) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({ from: `"SportX" <${process.env.SMTP_USER}>`, to, subject, html });
    console.log(`✅ Email sent via Gmail SMTP to ${to}`);
    return true;
  } catch (err) {
    console.error('❌ Gmail SMTP failed:', err.message);
    return false;
  }
}

async function sendMail(to, subject, html, otp) {
  // Try Resend first (best for Vercel)
  if (await sendViaResend(to, subject, html)) return;

  // Try Gmail SMTP
  if (await sendViaGmail(to, subject, html)) return;

  // Console fallback — OTP visible in Vercel Function logs
  console.log('\n════════════════════════════════════════');
  console.log(`📧 EMAIL FALLBACK — no provider configured`);
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  if (otp) console.log(`   OTP:     ${otp}  ← use this code`);
  console.log('════════════════════════════════════════\n');
}

function otpEmailHtml(otp, purpose) {
  const purposeText = {
    signup:      'verify your new SportX account',
    'login-otp': 'log in to your SportX account',
    reset:       'reset your SportX password'
  }[purpose] || 'continue';
  return `
    <div style="background:#0d0d0d;color:#e0e0e0;font-family:Inter,sans-serif;padding:40px;border-radius:12px;max-width:420px;margin:0 auto;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:900;color:#fff;margin-bottom:8px;">
        SPORT<span style="color:#F5A623">X</span>
      </div>
      <p style="color:#888;font-size:14px;margin-bottom:32px;">Elite Sports Equipment</p>
      <p style="font-size:15px;margin-bottom:24px;">Use the code below to <strong style="color:#fff">${purposeText}</strong>. It expires in <strong style="color:#F5A623">10 minutes</strong>.</p>
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#F5A623;font-family:monospace;">${otp}</div>
      </div>
      <p style="color:#555;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).toLowerCase()); }

function passwordStrength(p) {
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

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name)
    return res.status(400).json({ success: false, message: 'name, email and password are required' });
  if (!isValidEmail(email))
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  const pwErr = passwordStrength(password);
  if (pwErr) return res.status(400).json({ success: false, message: pwErr });
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ success: false, message: 'Email already registered' });

  const otp = generateOTP();
  const pendingUser = {
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    name,
    phone: req.body.phone || '',
    address: req.body.address || ''
  };

  otpStore[email.toLowerCase()] = {
    otp, expiresAt: Date.now() + 10 * 60 * 1000, purpose: 'signup', attempts: 0, pendingUser
  };

  const pendingToken = signJWT({ otp, purpose: 'signup', pendingUser });

  sendMail(email, 'Your SportX OTP Code', otpEmailHtml(otp, 'signup'), otp);

  // In dev/no-email-config mode, return OTP in response so you can still test
  const isDev = process.env.NODE_ENV !== 'production' || (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST);
  res.json({
    success: true,
    message: 'OTP sent to your email. Please verify to complete registration.',
    pendingToken,
    ...(isDev && { devOtp: otp, devNote: 'Email provider not configured — OTP returned here for testing' })
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp, pendingToken } = req.body || {};
  if (!email || !otp) return res.status(400).json({ success: false, message: 'email and otp are required' });

  let record = otpStore[email.toLowerCase()];

  if (!record && pendingToken) {
    const decoded = verifyJWT(pendingToken);
    if (!decoded) return res.status(400).json({ success: false, message: 'Session expired. Please register again.' });
    record = { ...decoded, attempts: 0, expiresAt: decoded.exp * 1000 };
  }

  if (!record) return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });

  if (Date.now() > record.expiresAt) {
    delete otpStore[email.toLowerCase()];
    return res.status(400).json({ success: false, message: 'OTP has expired. Please register again.' });
  }

  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > 5) {
    delete otpStore[email.toLowerCase()];
    return res.status(429).json({ success: false, message: 'Too many failed attempts. Please start over.' });
  }

  if (record.otp !== String(otp).trim())
    return res.status(400).json({ success: false, message: `Incorrect OTP. ${5 - record.attempts} attempt(s) remaining.` });

  delete otpStore[email.toLowerCase()];

  if (record.purpose === 'signup') {
    const { pendingUser } = record;
    const userId = `usr_${Date.now()}`;
    users.push({ id: userId, ...pendingUser, emailVerified: true, createdAt: new Date().toISOString() });
    const token = signJWT({ userId, email: pendingUser.email });
    return res.json({ success: true, message: 'Email verified!', token, userId, name: pendingUser.name, phone: pendingUser.phone, address: pendingUser.address, email: pendingUser.email });
  }

  if (record.purpose === 'login-otp') {
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.emailVerified = true;
    const token = signJWT({ userId: user.id, email: user.email });
    return res.json({ success: true, message: 'Logged in!', token, userId: user.id, name: user.name, email: user.email });
  }

  if (record.purpose === 'reset') {
    const resetToken = signJWT({ email: email.toLowerCase(), purpose: 'reset' }, 900);
    return res.json({ success: true, message: 'OTP verified', resetToken });
  }

  res.status(400).json({ success: false, message: 'Unknown OTP purpose' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, message: 'email and password are required' });
  const user = users.find(u => u.email === email.toLowerCase());
  const dummyStored = `${'0'.repeat(64)}:${'0'.repeat(128)}`;
  const valid = user ? verifyPassword(password, user.passwordHash) : (() => { verifyPassword('dummy', dummyStored); return false; })();
  if (!user || !valid) return res.status(401).json({ success: false, message: 'Invalid email or password' });
  if (!user.emailVerified) return res.status(403).json({ success: false, message: 'Email not verified. Please check your inbox.' });
  const token = signJWT({ userId: user.id, email: user.email });
  res.json({ success: true, token, userId: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address });
});

app.post('/api/auth/request-otp', (req, res) => {
  const { email, purpose = 'login-otp' } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: 'email required' });
  if (purpose === 'login-otp') {
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });
  }
  const otp = generateOTP();
  otpStore[email.toLowerCase()] = { otp, expiresAt: Date.now() + 10 * 60 * 1000, purpose, attempts: 0 };
  sendMail(email, 'Your SportX OTP Code', otpEmailHtml(otp, purpose), otp);
  const isDev = process.env.NODE_ENV !== 'production' || (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST);
  res.json({
    success: true,
    message: 'OTP sent to your email',
    ...(isDev && { devOtp: otp, devNote: 'Email provider not configured — OTP returned here for testing' })
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) return res.status(400).json({ success: false, message: 'resetToken and newPassword required' });
  const payload = verifyJWT(resetToken);
  if (!payload || payload.purpose !== 'reset') return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  const pwErr = passwordStrength(newPassword);
  if (pwErr) return res.status(400).json({ success: false, message: pwErr });
  const user = users.find(u => u.email === payload.email);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.passwordHash = hashPassword(newPassword);
  res.json({ success: true, message: 'Password reset successfully' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const { passwordHash, ...safe } = user;
  res.json({ success: true, data: safe });
});

// ─────────────────────────────────────────────────────────────
// PRODUCT / CART / ORDER ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/api/products', (req, res) => {
  let result = products;
  if (req.query.filter && req.query.filter !== 'all') result = result.filter(p => p.filter === req.query.filter);
  if (req.query.q) result = result.filter(p => p.name.toLowerCase().includes(req.query.q.toLowerCase()));
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
  if (existing) { existing.qty += qty; } else { cart.push({ id: cartIdCounter++, productId: parseInt(productId), type, qty, days }); }
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
  if (item.qty <= 0) { cart = cart.filter(c => c.id !== item.id); return res.json({ success: true, remove: true }); }
  res.json({ success: true, qty: item.qty });
});

app.post('/api/orders', (req, res) => {
  const { address = '', paymentMethod = 'COD', phone = '' } = req.body || {};
  if (cart.length === 0) return res.status(400).json({ success: false, message: 'Cart empty' });
  let total = 0;
  const orderItems = [];
  let hasRental = false;
  cart.forEach(c => {
    const p = products.find(p => p.id === c.productId);
    if (p) {
      const price = c.type === 'buy' ? p.price : p.rent * c.days;
      total += price * c.qty;
      orderItems.push({ productId: p.id, type: c.type, qty: c.qty, price });
      if (c.type === 'rent') hasRental = true;
    }
  });
  const securityDeposit = hasRental ? 499 : 0;
  total += securityDeposit;
  const orderId = `SX-${Date.now()}`;
  orders.unshift({ id: orderId, total, securityDeposit, createdAt: new Date().toISOString(), status: 'confirmed', address, paymentMethod, phone, items: orderItems });
  cart = [];
  res.status(201).json({ success: true, message: 'Order placed', orderId, securityDeposit });
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
  res.json({ success: true, data: { totalProducts, totalOrders, totalRevenue, lowStock } });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`\n🚀 SportX API running → http://localhost:${PORT}\n`));
}
module.exports = app;