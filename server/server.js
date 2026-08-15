require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const seedSkills = require('./seeders/skillSeeder');
const setupSocket = require('./socket/socketHandler');

// Routes
const authRoutes     = require('./routes/auth');
const userRoutes     = require('./routes/users');
const skillRoutes    = require('./routes/skills');
const discoverRoutes = require('./routes/discover');
const exchangeRoutes = require('./routes/exchange');
const roomRoutes     = require('./routes/rooms');

const app    = express();
const server = http.createServer(app);

// Connect to database
connectDB().then(() => {
  seedSkills();
});

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

setupSocket(io);

// ─── REST routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/skills',   skillRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/rooms',    roomRoutes);

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
