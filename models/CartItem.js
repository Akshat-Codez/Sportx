const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  userId: { type: String, required: true },
  productId: { type: Number, required: true },
  type: { type: String, enum: ['buy', 'rent'], required: true },
  qty: { type: Number, required: true, default: 1 },
  days: { type: Number, default: 1 }
});

module.exports = mongoose.models.CartItem || mongoose.model('CartItem', CartItemSchema);
