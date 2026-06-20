const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'data.json');

const store = {
  users: [],
  cart: [],
  orders: [],
  products: [
    { id:1, tag:"FIFA APPROVED", name:"Pro Football",      price:1499, rent:39,  icon:"⚽", filter:"balls",   stock:24 },
    { id:2, tag:"CARBON FIBER",  name:"Elite Badminton",   price:2199, rent:59,  icon:"🏸", filter:"rackets", stock:8 },
    { id:3, tag:"CLASSIC",       name:"SS Kashmir Willow", price:3999, rent:105, icon:"🏏", filter:"sticks",  stock:15 },
    { id:4, tag:"DURABLE",       name:"Kookaburra Helmet", price:1299, rent:49,  icon:"⛑️", filter:"helmets", stock:20 },
    { id:5, tag:"SPEED",         name:"Nike Mercurial",    price:4999, rent:190, icon:"👟", filter:"shoes",   stock:12 },
    { id:6, tag:"PRO BUNDLE",    name:"Full Cricket Kit",  price:8599, rent:499, icon:"🏏", filter:"kits",    stock:5  },
    { id:7, tag:"NBA GRADE",     name:"NBA Spalding",      price:3999, rent:99,  icon:"🏀", filter:"balls",   stock:18 },
    { id:8, tag:"TOUR",          name:"Wilson Pro Staff",  price:9999, rent:550, icon:"🎾", filter:"rackets", stock:3  },
    { id:9, tag:"PRO SPIN",       name:"Butterfly TT Racket",       price:2499, rent:75,  icon:"🏓", filter:"rackets", stock:14 },
    { id:10, tag:"ICE GRIP",      name:"Bauer Ice Hockey Skates",   price:7999, rent:350, icon:"⛸️", filter:"shoes",   stock:6  },
    { id:11, tag:"TOURNAMENT",    name:"Selkirk Pickleball Paddle", price:3499, rent:120, icon:"🏓", filter:"rackets", stock:10 },
    { id:12, tag:"STREET",        name:"Pro Glide Skates",          price:2999, rent:95,  icon:"🛼", filter:"shoes",   stock:22 },
    { id:13, tag:"PRO ICE",       name:"Bauer Ice Hockey Stick",    price:5999, rent:250, icon:"🏒", filter:"sticks",  stock:9  }
  ],
  cartIdx: 1,
  otpActivityLog: []
};

function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      store.users = data.users || [];
      store.cart = data.cart || [];
      store.orders = data.orders || [];
      store.cartIdx = data.cartIdx || 1;
      store.products = data.products || store.products;
    }
  } catch (e) {
    console.error('Failed to load data.json (may be normal on Vercel):', e.message);
  }
}

function saveData() {
  // Vercel serverless has a read-only filesystem; skip writes in production
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return;
  try {
    const data = { 
      users: store.users, 
      cart: store.cart, 
      orders: store.orders, 
      cartIdx: store.cartIdx, 
      products: store.products 
    };
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data.json:', e.message);
  }
}

// Automatically update orders to 'delivered' after 1 hour
function checkOrderStatuses() {
  const now = Date.now();
  let modified = false;
  store.orders.forEach(o => {
    if (o.status === 'confirmed') {
      const orderTime = new Date(o.createdAt).getTime();
      if (now - orderTime >= 60 * 60 * 1000) { // 1 hour
        o.status = 'delivered';
        modified = true;
      }
    }
  });
  if (modified) saveData();
}

function init() {
  loadData();
  checkOrderStatuses();
  setInterval(checkOrderStatuses, 60000); // Check every minute
}

module.exports = {
  store,
  loadData,
  saveData,
  init
};
