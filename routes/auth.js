const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const OtpLog = require('../models/OtpLog');
const { hashPassword, verifyPassword, signJWT, verifyJWT, requireAuth } = require('../utils/auth');

const router = express.Router();

function generateOTP() { return crypto.randomInt(100000, 999999).toString(); }

async function logOTP(phone, otp, purpose) {
  const line = '═'.repeat(44);
  console.log(`\n╔${line}╗`);
  console.log(`║  SPORTX OTP  —  ${purpose.toUpperCase().padEnd(26)}║`);
  console.log(`║  Phone : ${phone.padEnd(34)}║`);
  console.log(`║  OTP   : ${otp.padEnd(34)}║`);
  console.log(`╚${line}╝\n`);
  
  try {
    await OtpLog.create({ phone, otp, purpose });
  } catch (err) {
    console.error('Failed to log OTP to DB:', err.message);
  }
}

function isPhone(p) { return /^[6-9]\d{9}$/.test(String(p).replace(/\s|\+91/g,'')); }
function normalizePhone(p) { return String(p).replace(/\s|\+91/g,''); }

function pwStrength(p) {
  if (!p || p.length < 6 || !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/\d/.test(p) || !/[^A-Za-z0-9]/.test(p)) {
    return 'A password should contain special character, digit, Capital Letter, Small Letter, min 6 characters';
  }
  return null;
}

router.post('/register', async (req, res) => {
  try {
    const { password, name } = req.body || {};
    const phone = normalizePhone(req.body.phone || '');

    if (!phone || !password || !name)
      return res.status(400).json({ success:false, message:'name, phone and password are required' });
    if (!isPhone(phone))
      return res.status(400).json({ success:false, message:'Enter a valid 10-digit Indian mobile number' });

    const pwErr = pwStrength(password);
    if (pwErr) return res.status(400).json({ success:false, message:pwErr });

    const existingUser = await User.findOne({ phone });
    if (existingUser)
      return res.status(409).json({ success:false, message:'Phone number already registered' });

    const otp = generateOTP();
    await logOTP(phone, otp, 'SIGNUP');

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
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
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
      const existingUser = await User.findOne({ phone: pendingUser.phone });
      if (existingUser)
        return res.status(409).json({ success:false, message:'Already registered. Please sign in.' });
      
      const userId = `usr_${Date.now()}`;
      await User.create({ id: userId, ...pendingUser, verified: true });
      
      const token = signJWT({ userId, phone: pendingUser.phone });
      return res.json({ success:true, message:'Account created!', token, userId, name: pendingUser.name, phone: pendingUser.phone });
    }

    if (decoded.purpose === 'login-otp') {
      const user = await User.findOne({ phone });
      if (!user) return res.status(404).json({ success:false, message:'User not found' });
      const token = signJWT({ userId: user.id, phone: user.phone });
      return res.json({ success:true, message:'Logged in!', token, userId: user.id, name: user.name, phone: user.phone });
    }

    res.status(400).json({ success:false, message:'Unknown purpose' });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const phone = normalizePhone(req.body.phone || '');
    if (!phone || !password)
      return res.status(400).json({ success:false, message:'phone and password are required' });

    const user = await User.findOne({ phone });
    const dummy = `${'0'.repeat(64)}:${'0'.repeat(128)}`;
    const ok = user ? verifyPassword(password, user.passwordHash) : (verifyPassword('x', dummy), false);
    if (!user || !ok)
      return res.status(401).json({ success:false, message:'Invalid phone number or password' });

    const token = signJWT({ userId: user.id, phone: user.phone });
    res.json({ success:true, token, userId: user.id, name: user.name, phone: user.phone });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.post('/request-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone || '');
    if (!phone) return res.status(400).json({ success:false, message:'phone required' });
    if (!isPhone(phone)) return res.status(400).json({ success:false, message:'Enter a valid 10-digit Indian mobile number' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ success:false, message:'No account with that phone number' });

    const otp = generateOTP();
    await logOTP(phone, otp, 'LOGIN-OTP');

    const pendingToken = signJWT({ otp, purpose:'login-otp', phone }, 600);
    res.json({
      success       : true,
      message       : 'OTP sent. Please enter the 6-digit code.',
      pendingToken,
      _adminOtp     : otp,
      _adminPhone   : phone,
      _adminPurpose : 'login-otp'
    });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.userId });
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    
    // Convert mongoose document to plain object and remove passwordHash
    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    
    res.json({ success:true, data: safeUser });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
});

module.exports = router;
