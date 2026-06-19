const express = require('express');
const crypto = require('crypto');
const { store, saveData } = require('../store');
const { hashPassword, verifyPassword, signJWT, verifyJWT, requireAuth } = require('../utils/auth');

const router = express.Router();

function generateOTP() { return crypto.randomInt(100000, 999999).toString(); }

function logOTP(phone, otp, purpose) {
  const line = '═'.repeat(44);
  console.log(`\n╔${line}╗`);
  console.log(`║  SPORTX OTP  —  ${purpose.toUpperCase().padEnd(26)}║`);
  console.log(`║  Phone : ${phone.padEnd(34)}║`);
  console.log(`║  OTP   : ${otp.padEnd(34)}║`);
  console.log(`╚${line}╝\n`);
  store.otpActivityLog.unshift({ phone, otp, purpose, time: new Date().toISOString() });
  if (store.otpActivityLog.length > 200) store.otpActivityLog.pop();
}

function isPhone(p) { return /^[6-9]\d{9}$/.test(String(p).replace(/\s|\+91/g,'')); }
function normalizePhone(p) { return String(p).replace(/\s|\+91/g,''); }

function pwStrength(p) {
  if (!p || p.length < 6 || !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/\d/.test(p) || !/[^A-Za-z0-9]/.test(p)) {
    return 'A password should contain special character, digit, Capital Letter, Small Letter, min 6 characters';
  }
  return null;
}

router.post('/register', (req, res) => {
  const { password, name } = req.body || {};
  const phone = normalizePhone(req.body.phone || '');

  if (!phone || !password || !name)
    return res.status(400).json({ success:false, message:'name, phone and password are required' });
  if (!isPhone(phone))
    return res.status(400).json({ success:false, message:'Enter a valid 10-digit Indian mobile number' });

  const pwErr = pwStrength(password);
  if (pwErr) return res.status(400).json({ success:false, message:pwErr });

  if (store.users.find(u => u.phone === phone))
    return res.status(409).json({ success:false, message:'Phone number already registered' });

  const otp = generateOTP();
  logOTP(phone, otp, 'SIGNUP');

  const pendingUser = {
    phone,
    passwordHash : hashPassword(password),
    name,
    address      : req.body.address || ''
  };

  const pendingToken = signJWT({ otp, purpose:'signup', pendingUser }, 600);

  res.json({
    success        : true,
    message        : 'OTP sent. Please enter the 6-digit code.',
    pendingToken,
    _adminOtp      : otp,
    _adminPhone    : phone,
    _adminPurpose  : 'signup'
  });
});

router.post('/verify-otp', (req, res) => {
  const { otp, pendingToken } = req.body || {};
  const phone = normalizePhone(req.body.phone || '');

  if (!phone || !otp || !pendingToken)
    return res.status(400).json({ success:false, message:'phone, otp and pendingToken are required' });

  const decoded = verifyJWT(pendingToken);
  if (!decoded)
    return res.status(400).json({ success:false, message:'OTP expired (10 min). Please request a new one.' });

  if (decoded.otp !== String(otp).trim())
    return res.status(400).json({ success:false, message:'Incorrect OTP. Please try again.' });

  if (decoded.purpose === 'signup') {
    const { pendingUser } = decoded;
    if (store.users.find(u => u.phone === pendingUser.phone))
      return res.status(409).json({ success:false, message:'Already registered. Please sign in.' });
    const userId = `usr_${Date.now()}`;
    store.users.push({ id:userId, ...pendingUser, verified:true, createdAt:new Date().toISOString() });
    saveData();
    const token = signJWT({ userId, phone:pendingUser.phone });
    return res.json({ success:true, message:'Account created!', token, userId, name:pendingUser.name, phone:pendingUser.phone });
  }

  if (decoded.purpose === 'login-otp') {
    const user = store.users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    const token = signJWT({ userId:user.id, phone:user.phone });
    return res.json({ success:true, message:'Logged in!', token, userId:user.id, name:user.name, phone:user.phone });
  }

  res.status(400).json({ success:false, message:'Unknown purpose' });
});

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const phone = normalizePhone(req.body.phone || '');
  if (!phone || !password)
    return res.status(400).json({ success:false, message:'phone and password are required' });

  const user  = store.users.find(u => u.phone === phone);
  const dummy = `${'0'.repeat(64)}:${'0'.repeat(128)}`;
  const ok    = user ? verifyPassword(password, user.passwordHash) : (verifyPassword('x', dummy), false);
  if (!user || !ok)
    return res.status(401).json({ success:false, message:'Invalid phone number or password' });

  const token = signJWT({ userId:user.id, phone:user.phone });
  res.json({ success:true, token, userId:user.id, name:user.name, phone:user.phone });
});

router.post('/request-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone || '');
  if (!phone) return res.status(400).json({ success:false, message:'phone required' });
  if (!isPhone(phone)) return res.status(400).json({ success:false, message:'Enter a valid 10-digit Indian mobile number' });

  const user = store.users.find(u => u.phone === phone);
  if (!user) return res.status(404).json({ success:false, message:'No account with that phone number' });

  const otp = generateOTP();
  logOTP(phone, otp, 'LOGIN-OTP');

  const pendingToken = signJWT({ otp, purpose:'login-otp', phone }, 600);
  res.json({
    success       : true,
    message       : 'OTP sent. Please enter the 6-digit code.',
    pendingToken,
    _adminOtp     : otp,
    _adminPhone   : phone,
    _adminPurpose : 'login-otp'
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = store.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ success:false, message:'User not found' });
  const { passwordHash, ...safe } = user;
  res.json({ success:true, data:safe });
});

module.exports = router;
