const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['buy', 'rent'], required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom ID SX-...
  userId: { type: String, required: true },
  total: { type: Number, required: true },
  securityDeposit: { type: Number, default: 0 },
  status: { type: String, enum: ['confirmed', 'transit', 'delivered', 'cancelled'], default: 'confirmed' },
  address: { type: String, required: true },
  paymentMethod: { type: String, default: 'COD' },
  phone: { type: String, required: true },
  items: [OrderItemSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
