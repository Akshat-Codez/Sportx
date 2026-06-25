const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  tag: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  rent: { type: Number, required: true },
  icon: { type: String, required: true },
  filter: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 }
});

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
