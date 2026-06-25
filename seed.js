const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const fs = require('fs');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env');
  process.exit(1);
}

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    let products = [];
    if (fs.existsSync('./data.json')) {
      const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
      products = data.products || [];
    } else {
      // Fallback
      products = [
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
      ];
    }

    if (products.length > 0) {
      await Product.deleteMany({});
      await Product.insertMany(products);
      console.log('Successfully seeded database with products from data.json');
    } else {
      console.log('No products found to seed.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
