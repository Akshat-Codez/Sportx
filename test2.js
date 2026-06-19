const crypto = require('crypto');

const JWT_SECRET = 'sportx-dev-secret-change-in-prod';
function b64u(s) {
  return Buffer.from(s).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function signJWT(payload, ttl = 604800) {
  const h = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const b = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + ttl }));
  const s = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${h}.${b}.${s}`;
}

const token = signJWT({ userId: 'test_user_123', phone: '9999999999' });

async function run() {
  // Add to cart
  await fetch('http://localhost:4000/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ productId: 1, type: 'rent', qty: 1, days: 7 })
  });

  // Get cart
  const c = await fetch('http://localhost:4000/api/cart', { headers: { 'Authorization': `Bearer ${token}` }});
  console.log('Cart:', await c.json());

  // Checkout
  const o = await fetch('http://localhost:4000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ address: 'Test', paymentMethod: 'UPI' })
  });
  console.log('Order:', await o.json());
}
run();
