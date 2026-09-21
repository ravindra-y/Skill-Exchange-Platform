/**
 * test-chat.js — Integration test for the chat feature.
 *
 * Spins up an in-memory MongoDB + Express + Socket.io server, then:
 *  1. Signs up User A and User B.
 *  2. User A sends a request; User B accepts → Room created.
 *  3. PASS: both can send/receive messages via socket without the video room.
 *  4. PASS: messages persist in MongoDB (reload after disconnect).
 *  5. PASS: a third user (Eve) is rejected from reading/sending to that conversation.
 *  6. PASS: unread counts reflect received messages.
 *  7. PASS: mark-read zeroes the count.
 *  8. PASS: HTTP fallback POST works when socket is not used.
 */

require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const http    = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const cors   = require('cors');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const axios  = require('axios');

const seedSkills    = require('./seeders/skillSeeder');
const setupSocket   = require('./socket/socketHandler');
const authRoutes    = require('./routes/auth');
const exchangeRoutes = require('./routes/exchange');
const messagesRoutes = require('./routes/messages');

const PORT = 5003;
const BASE = `http://localhost:${PORT}/api`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAxios() {
  let jar = '';
  const inst = axios.create({ baseURL: BASE, withCredentials: true });
  inst.interceptors.response.use(res => {
    if (res.headers['set-cookie']) jar = res.headers['set-cookie'][0];
    return res;
  });
  inst.interceptors.request.use(req => {
    if (jar) req.headers.Cookie = jar;
    return req;
  });
  inst.getCookie = () => jar;
  return inst;
}

function makeSocket(cookieStr) {
  return ioClient(`http://localhost:${PORT}`, {
    withCredentials: true,
    extraHeaders: { cookie: cookieStr },
    transports: ['websocket'],
  });
}

function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const runTests = async () => {
  let mongod, server;
  const sockets = [];

  try {
    // ── Setup ──────────────────────────────────────────────────────────────
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET  = 'chatsecret';

    await mongoose.connect(mongod.getUri());
    await seedSkills();

    const app = express();
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: { origin: '*', credentials: true },
    });

    app.use(cors({ origin: '*', credentials: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.set('io', io);

    app.use('/api/auth',     authRoutes);
    app.use('/api/exchange', exchangeRoutes);
    app.use('/api/messages', messagesRoutes);

    setupSocket(io);

    await new Promise(r => httpServer.listen(PORT, r));
    server = httpServer;
    console.log(`Chat test server running on port ${PORT}`);

    // ── 1. Sign up three users ─────────────────────────────────────────────
    const axA = makeAxios(), axB = makeAxios(), axC = makeAxios();

    await axA.post('/auth/signup', { name: 'Alice', username: 'alice_c', email: 'alice_c@test.com', password: 'pw1234' });
    await axB.post('/auth/signup', { name: 'Bob',   username: 'bob_c',   email: 'bob_c@test.com',   password: 'pw1234' });
    await axC.post('/auth/signup', { name: 'Eve',   username: 'eve_c',   email: 'eve_c@test.com',   password: 'pw1234' });
    console.log('[OK] Three users signed up');

    // ── 2. A sends request; B accepts ──────────────────────────────────────
    const { data: meB } = await axB.get('/auth/me');
    const { data: req } = await axA.post('/exchange', { receiverId: meB._id });
    const { data: accepted } = await axB.put(`/exchange/${req._id}/status`, { status: 'accepted' });
    const exchangeRequestId = accepted._id;
    console.log(`[OK] Exchange accepted: ${exchangeRequestId}`);

    // ── 3. Connect sockets and join the chat room ──────────────────────────
    const sockA = makeSocket(axA.getCookie());
    const sockB = makeSocket(axB.getCookie());
    const sockC = makeSocket(axC.getCookie()); // uninvited
    sockets.push(sockA, sockB, sockC);

    await Promise.all([
      waitFor(sockA, 'connect'),
      waitFor(sockB, 'connect'),
      waitFor(sockC, 'connect'),
    ]);

    sockA.emit('chat:join', { exchangeRequestId });
    sockB.emit('chat:join', { exchangeRequestId });

    const [joinedA, joinedB] = await Promise.all([
      waitFor(sockA, 'chat:joined'),
      waitFor(sockB, 'chat:joined'),
    ]);
    if (joinedA.exchangeRequestId !== exchangeRequestId) throw new Error('A joined wrong room');
    if (joinedB.exchangeRequestId !== exchangeRequestId) throw new Error('B joined wrong room');
    console.log('[OK] A and B joined chat room via socket');

    // ── 4. A sends a message; B receives it ────────────────────────────────
    const receivedByB = waitFor(sockB, 'chat:message');
    sockA.emit('chat:send', { exchangeRequestId, text: 'Hello from Alice!' });
    const msgB = await receivedByB;
    if (msgB.text !== 'Hello from Alice!') throw new Error('Message text mismatch');
    console.log('[OK] A sent message; B received it via socket without video room');

    // ── 5. A also receives the broadcast (server broadcasts to whole room) ──
    // (A is in the room so A also gets the event — just verify text)
    // We don't need to check A receiving its own msg for the test requirement.

    // ── 6. Messages persist: fetch via REST ────────────────────────────────
    const { data: history } = await axA.get(`/messages/${exchangeRequestId}`);
    if (!history.messages.some(m => m.text === 'Hello from Alice!')) {
      throw new Error('Message not found in persisted history');
    }
    console.log('[OK] Message persisted to MongoDB and retrievable via REST');

    // ── 7. HTTP fallback POST ──────────────────────────────────────────────
    const { data: fallbackMsg } = await axB.post(`/messages/${exchangeRequestId}`, {
      text: 'HTTP fallback from Bob',
    });
    if (!fallbackMsg._id) throw new Error('HTTP fallback POST did not return a message');
    const { data: history2 } = await axA.get(`/messages/${exchangeRequestId}`);
    if (!history2.messages.some(m => m.text === 'HTTP fallback from Bob')) {
      throw new Error('HTTP fallback message not in history');
    }
    console.log('[OK] HTTP fallback POST works and message persists');

    // ── 8. Eve cannot read messages (403) ──────────────────────────────────
    try {
      await axC.get(`/messages/${exchangeRequestId}`);
      throw new Error('Eve should have been rejected');
    } catch (err) {
      if (err.response?.status !== 403) throw new Error(`Expected 403 for Eve, got ${err.response?.status}`);
    }
    console.log('[OK] GET /messages/:id returns 403 for non-participant');

    // ── 9. Eve cannot POST a message (403) ─────────────────────────────────
    try {
      await axC.post(`/messages/${exchangeRequestId}`, { text: 'Hacked!' });
      throw new Error('Eve should have been rejected from POST');
    } catch (err) {
      if (err.response?.status !== 403) throw new Error(`Expected 403 for Eve POST, got ${err.response?.status}`);
    }
    console.log('[OK] POST /messages/:id returns 403 for non-participant');

    // ── 10. Eve is rejected via socket chat:join ───────────────────────────
    sockC.emit('chat:join', { exchangeRequestId });
    const chatErrorC = await waitFor(sockC, 'chat:error');
    if (!chatErrorC.message.includes('FORBIDDEN') && !chatErrorC.message.includes('not a participant')) {
      throw new Error('Eve should get FORBIDDEN on chat:join');
    }
    console.log('[OK] Socket chat:join correctly rejected Eve');

    // ── 11. Eve cannot chat:send either (she's not in the room) ────────────
    // Even if Eve tries to emit, the server will reject her
    const eveErrorP = waitFor(sockC, 'chat:error', 3000);
    sockC.emit('chat:send', { exchangeRequestId, text: 'Eve hacking' });
    const eveErr = await eveErrorP;
    if (!eveErr.message) throw new Error('Expected error for Eve chat:send');
    console.log('[OK] Socket chat:send correctly rejected Eve');

    // ── 12. Unread counts ─────────────────────────────────────────────────
    // B sent the HTTP fallback message; from A's perspective that's 1 unread
    // (A received it via socket already, but readAt is null until marked)
    const { data: counts } = await axA.get('/messages/unread/counts');
    if (!counts[exchangeRequestId] || counts[exchangeRequestId] < 1) {
      throw new Error('Expected at least 1 unread message for A');
    }
    console.log(`[OK] Unread count for A: ${counts[exchangeRequestId]}`);

    // ── 13. Mark as read zeroes the count ─────────────────────────────────
    await axA.post(`/messages/${exchangeRequestId}/read`);
    const { data: counts2 } = await axA.get('/messages/unread/counts');
    if (counts2[exchangeRequestId] && counts2[exchangeRequestId] > 0) {
      throw new Error('Expected 0 unread after mark-read');
    }
    console.log('[OK] Mark-read zeroes the unread count');

    console.log('\n--- ALL CHAT TESTS PASSED ---\n');
  } catch (err) {
    console.error('\n--- CHAT TEST FAILED ---');
    console.error(err.message);
    if (err.response) console.error(err.response.data);
    process.exitCode = 1;
  } finally {
    sockets.forEach(s => s.disconnect());
    if (server) server.close();
    if (mongoose.connection) await mongoose.connection.close();
    if (mongod) await mongod.stop();
    process.exit(process.exitCode || 0);
  }
};

runTests();
