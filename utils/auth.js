const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// Password Hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return attempt === hash;
}

// Simple JWT implementation
function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJWT(payload, expiresInSeconds = 86400 * 30) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payloadStr = base64url(JSON.stringify({ ...payload, exp }));
  const signature = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payloadStr}`).digest());
  return `${header}.${payloadStr}.${signature}`;
}

function verifyJWT(token) {
  try {
    const [header, payloadStr, signature] = token.split('.');
    const expectedSig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payloadStr}`).digest());
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadStr.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success:false, message:'Unauthorized' });
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyJWT(token);
  if (!decoded) return res.status(401).json({ success:false, message:'Invalid or expired token' });
  
  req.userId = decoded.userId;
  req.phone = decoded.phone;
  next();
}

function requireAdmin(req, res, next) {
  // Hardcoded admin check matching frontend logic
  if (req.phone === '9999999999') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
  }
}

function requireAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Admin authentication required' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyJWT(token);
  if (!decoded || decoded.role !== 'admin')
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });

  req.adminId = decoded.adminId;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  requireAuth,
  requireAdmin,
  requireAdminToken
};
