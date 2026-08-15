/**
 * Phase 2 integration test
 * Starts an in-memory Mongo server + Express + Socket.io,
 * then verifies room access authorization and socket events.
 */
require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const http    = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const cors          = require('cors');
const cookieParser  = require('cookie-parser');
const mongoose      = require('mongoose');
const axios         = require('axios');
const setupSocket   = require('./socket/socketHandler');

const authRoutes     = require('./routes/auth');
const userRoutes     = require('./routes/users');
const skillRoutes    = require('./routes/skills');
const discoverRoutes = require('./routes/discover');
const exchangeRoutes = require('./routes/exchange');
const roomRoutes     = require('./routes/rooms');
const seedSkills     = require('./seeders/skillSeeder');

const PORT    = 5002;
const API_URL = `http://localhost:${PORT}/api`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const runTests = async () => {
  let mongod, server, socketServer;

  try {
    // ── 1. Boot infrastructure ─────────────────────────────────────────────
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET  = 'phase2testsecret';
    process.env.NODE_ENV    = 'development';

    await mongoose.connect(process.env.MONGODB_URI);
    await seedSkills();

    const app = express();
    app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
    app.use(express.json());
    app.use(cookieParser());

    app.use('/api/auth',     authRoutes);
    app.use('/api/users',    userRoutes);
    app.use('/api/skills',   skillRoutes);
    app.use('/api/discover', discoverRoutes);
    app.use('/api/exchange', exchangeRoutes);
    app.use('/api/rooms',    roomRoutes);

    server = http.createServer(app);
    socketServer = new Server(server, {
      cors: { origin: 'http://localhost:5173', credentials: true, methods: ['GET','POST'] },
    });
    setupSocket(socketServer);

    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`Phase 2 test server running on port ${PORT}`);

    // ── 2. Sign up two users ───────────────────────────────────────────────
    const makeAxios = () => {
      let cookie = '';
      const inst = axios.create({ baseURL: API_URL, withCredentials: true });
      inst.interceptors.response.use(res => {
        if (res.headers['set-cookie']) cookie = res.headers['set-cookie'][0];
        return res;
      });
      inst.interceptors.request.use(req => {
        if (cookie) req.headers.Cookie = cookie;
        return req;
      });
      inst.getCookie = () => cookie;
      return inst;
    };

    const axA = makeAxios();
    const axB = makeAxios();
    const axC = makeAxios(); // uninvited third user

    const { data: userA } = await axA.post('/auth/signup', { name:'Alice', username:'alice', email:'alice@test.com', password:'pw' });
    const { data: userB } = await axB.post('/auth/signup', { name:'Bob',   username:'bob',   email:'bob@test.com',   password:'pw' });
    await axC.post('/auth/signup', { name:'Eve', username:'eve', email:'eve@test.com', password:'pw' });
    console.log('[OK] Three users signed up');

    // ── 3. Accept a request so a Room is created ───────────────────────────
    const { data: exReq } = await axA.post('/exchange', { receiverId: userB._id });
    await axB.put(`/exchange/${exReq._id}/status`, { status: 'accepted' });

    const { data: room } = await axA.get(`/rooms/by-exchange/${exReq._id}`);
    console.log(`[OK] Room created: ${room._id}`);

    // ── 4. REST: 403 for uninvited user ────────────────────────────────────
    try {
      await axC.get(`/rooms/${room._id}`);
      throw new Error('Should have returned 403');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('[OK] GET /rooms/:id returns 403 for uninvited user');
      } else throw err;
    }

    // ── 5. Socket: User A joins, gets room-joined ──────────────────────────
    const connectSocket = (cookie) => new Promise((resolve, reject) => {
      const s = ioClient(`http://localhost:${PORT}`, {
        withCredentials: true,
        extraHeaders: { Cookie: cookie },
        reconnection: false,
      });
      s.on('connect', () => resolve(s));
      s.on('connect_error', (err) => reject(err));
    });

    const sockA = await connectSocket(axA.getCookie());
    const joinedA = await new Promise((resolve, reject) => {
      sockA.emit('join-room', { roomId: room._id });
      sockA.on('room-joined', resolve);
      sockA.on('room-error',  (e) => reject(new Error(e.message)));
      setTimeout(() => reject(new Error('Timeout waiting for room-joined (A)')), 3000);
    });
    console.log(`[OK] User A joined room (peerAlreadyPresent=${joinedA.peerAlreadyPresent})`);

    // ── 6. Socket: User B joins, A gets peer-joined ────────────────────────
    const sockB = await connectSocket(axB.getCookie());
    const [joinedB, peerJoinedForA] = await Promise.all([
      new Promise((resolve, reject) => {
        sockB.emit('join-room', { roomId: room._id });
        sockB.on('room-joined', resolve);
        sockB.on('room-error',  (e) => reject(new Error(e.message)));
        setTimeout(() => reject(new Error('Timeout waiting for room-joined (B)')), 3000);
      }),
      new Promise((resolve, reject) => {
        sockA.once('peer-joined', resolve);
        setTimeout(() => reject(new Error('Timeout waiting for peer-joined on A')), 3000);
      }),
    ]);
    console.log(`[OK] User B joined room (peerAlreadyPresent=${joinedB.peerAlreadyPresent})`);
    console.log(`[OK] User A received peer-joined event`);

    // ── 7. Socket: Eve is REJECTED ─────────────────────────────────────────
    const sockC = await connectSocket(axC.getCookie());
    const errorC = await new Promise((resolve, reject) => {
      sockC.emit('join-room', { roomId: room._id });
      sockC.on('room-error', resolve);
      sockC.on('room-joined', () => reject(new Error('Eve should NOT have been allowed to join!')));
      setTimeout(() => reject(new Error('Timeout waiting for room-error on Eve')), 3000);
    });
    if (errorC.message.includes('FORBIDDEN')) {
      console.log('[OK] Uninvited user (Eve) was correctly rejected from the room socket');
    } else {
      throw new Error(`Unexpected room-error: ${errorC.message}`);
    }

    // ── 8. Whiteboard relay ────────────────────────────────────────────────
    const testStroke = { x0: 10, y0: 20, x1: 30, y1: 40, color: '#ff0000', width: 3, eraser: false };
    const receivedStroke = await new Promise((resolve, reject) => {
      sockB.once('draw', resolve);
      sockA.emit('draw', { roomId: room._id, stroke: testStroke });
      setTimeout(() => reject(new Error('Timeout waiting for draw event on B')), 3000);
    });
    if (receivedStroke.stroke.x0 === testStroke.x0 && receivedStroke.stroke.color === testStroke.color) {
      console.log('[OK] Whiteboard draw relayed from A to B correctly');
    } else {
      throw new Error('Draw event data mismatch');
    }

    // ── 9. Whiteboard clear ────────────────────────────────────────────────
    const clearReceived = await new Promise((resolve, reject) => {
      sockB.once('whiteboard-clear', resolve);
      sockA.emit('whiteboard-clear', { roomId: room._id });
      setTimeout(() => reject(new Error('Timeout waiting for whiteboard-clear')), 3000);
    });
    console.log('[OK] whiteboard-clear relayed from A to B');

    // ── 10. Leave event ────────────────────────────────────────────────────
    const peerLeftB = new Promise((resolve, reject) => {
      sockB.once('peer-left', resolve);
      setTimeout(() => reject(new Error('Timeout waiting for peer-left on B')), 3000);
    });
    sockA.emit('leave-room', { roomId: room._id });
    await peerLeftB;
    console.log('[OK] peer-left event received by B after A leaves');

    // Cleanup sockets
    sockA.disconnect();
    sockB.disconnect();
    sockC.disconnect();

    console.log('\n--- ALL PHASE 2 TESTS PASSED ---');
  } catch (err) {
    console.error('\n--- PHASE 2 TEST FAILED ---');
    console.error(err.message);
    if (err.response) console.error(err.response.data);
    process.exitCode = 1;
  } finally {
    if (server)       server.close();
    if (socketServer) socketServer.close();
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
    if (mongod)       await mongod.stop();
    process.exit(process.exitCode || 0);
  }
};

runTests();
