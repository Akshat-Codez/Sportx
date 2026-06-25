const mongoose = require('mongoose');

const OtpLogSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { type: String, required: true },
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.models.OtpLog || mongoose.model('OtpLog', OtpLogSchema);
