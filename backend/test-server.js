require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const seedSkills = require('./seeders/skillSeeder');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const skillRoutes = require('./routes/skills');
const discoverRoutes = require('./routes/discover');
const exchangeRoutes = require('./routes/exchange');

const startServer = async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'testsecret';

  await mongoose.connect(uri);
  console.log(`Test MongoDB connected at ${uri}`);
  
  await seedSkills();

  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/skills', skillRoutes);
  app.use('/api/discover', discoverRoutes);
  app.use('/api/exchange', exchangeRoutes);

  app.listen(5000, () => {
    console.log('Test Server running on port 5000');
  });
};

startServer();
