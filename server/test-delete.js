/**
 * test-delete.js — Integration test for account deletion.
 *
 * 1. Signs up Alice and Bob.
 * 2. Creates a shared ExchangeRequest, Room, and some Messages.
 * 3. PASS: Alice tries to delete with wrong password (401).
 * 4. PASS: Alice deletes with correct password (200).
 * 5. PASS: Alice's User, UserSkill, ExchangeRequest, Room, Messages are gone.
 * 6. PASS: Bob's User is untouched.
 * 7. PASS: Alice's old JWT is invalidated (cookie cleared / unauthorized).
 */

require('dotenv').config();
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const http    = require('http');
const express = require('express');
const cors   = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const axios  = require('axios');

const seedSkills    = require('./seeders/skillSeeder');
const authRoutes    = require('./routes/auth');
const usersRoutes   = require('./routes/users');
const exchangeRoutes = require('./routes/exchange');
const messagesRoutes = require('./routes/messages');

const User = require('./models/User');
const UserSkill = require('./models/UserSkill');
const ExchangeRequest = require('./models/ExchangeRequest');
const Room = require('./models/Room');
const Message = require('./models/Message');

const PORT = 5004;
const BASE = `http://localhost:${PORT}/api`;

function makeAxios() {
  let jar = '';
  const inst = axios.create({ baseURL: BASE, withCredentials: true, validateStatus: () => true });
  inst.interceptors.response.use(res => {
    if (res.headers['set-cookie']) jar = res.headers['set-cookie'][0];
    return res;
  });
  inst.interceptors.request.use(req => {
    if (jar) req.headers.Cookie = jar;
    return req;
  });
  return inst;
}

const runTests = async () => {
  let replset, server;

  try {
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replset.getUri();
    process.env.JWT_SECRET  = 'deletesecret';

    await mongoose.connect(replset.getUri());
    await seedSkills();

    const app = express();
    const httpServer = http.createServer(app);

    app.use(cors({ origin: '*', credentials: true }));
    app.use(express.json());
    app.use(cookieParser());

    app.use('/api/auth',     authRoutes);
    app.use('/api/users',    usersRoutes);
    app.use('/api/exchange', exchangeRoutes);
    app.use('/api/messages', messagesRoutes);

    // Mock room endpoint since we don't have socket.io in this script but need a Room created.
    // Wait, Room is typically created when the exchange request is accepted. Let's verify.
    // In exchange.js, accepting an exchange request automatically creates a Room document.

    await new Promise(r => httpServer.listen(PORT, r));
    server = httpServer;
    console.log(`Delete test server running on port ${PORT}`);

    const axA = makeAxios();
    const axB = makeAxios();

    // 1. Signups
    await axA.post('/auth/signup', { name: 'Alice', username: 'alice_del', email: 'alice_del@test.com', password: 'password123' });
    await axB.post('/auth/signup', { name: 'Bob',   username: 'bob_del',   email: 'bob_del@test.com',   password: 'password123' });
    console.log('[OK] Alice and Bob signed up');

    const meA = (await axA.get('/auth/me')).data;
    const meB = (await axB.get('/auth/me')).data;

    // Add a skill for Alice to verify UserSkill deletion
    const skill = await mongoose.connection.collection('skills').findOne({});
    await axA.post('/users/skills', { skillId: skill._id, type: 'teach' });

    // 2. Exchange Request
    const reqRes = await axA.post('/exchange', { receiverId: meB._id });
    if (reqRes.status !== 201) throw new Error('Exchange req failed');
    const exReqId = reqRes.data._id;

    const accRes = await axB.put(`/exchange/${exReqId}/status`, { status: 'accepted' });
    if (accRes.status !== 200) throw new Error('Accept failed');

    // 3. Message
    await axA.post(`/messages/${exReqId}`, { text: 'Hello Bob' });
    await axB.post(`/messages/${exReqId}`, { text: 'Hello Alice' });
    console.log('[OK] Exchange accepted, room created, messages sent');

    // 4. Verification before delete
    let roomCount = await Room.countDocuments({ exchangeRequestId: exReqId });
    if (roomCount !== 1) throw new Error('Room was not created');
    let msgCount = await Message.countDocuments({ exchangeRequestId: exReqId });
    if (msgCount !== 2) throw new Error('Messages not created');

    // 5. Try delete with wrong password
    let delRes = await axA.delete('/users/me', { data: { password: 'wrongpassword' } });
    if (delRes.status !== 401) throw new Error('Expected 401 for wrong password');
    console.log('[OK] Deletion with wrong password blocked');

    // 6. Delete with correct password
    delRes = await axA.delete('/users/me', { data: { password: 'password123' } });
    if (delRes.status !== 200) throw new Error(`Expected 200 for correct password, got ${delRes.status}: ${delRes.data.message}`);
    console.log('[OK] Account deleted successfully');

    // 7. Verification after delete
    const aliceDoc = await User.findById(meA._id);
    if (aliceDoc) throw new Error('Alice still exists in DB');
    const aliceSkills = await UserSkill.countDocuments({ userId: meA._id });
    if (aliceSkills !== 0) throw new Error('Alice UserSkill still exists');
    
    const exReqs = await ExchangeRequest.countDocuments({ $or: [{ senderId: meA._id }, { receiverId: meA._id }] });
    if (exReqs !== 0) throw new Error('ExchangeRequests not deleted');

    const rooms = await Room.countDocuments({ exchangeRequestId: exReqId });
    if (rooms !== 0) throw new Error('Rooms not deleted');

    const msgs = await Message.countDocuments({ exchangeRequestId: exReqId });
    if (msgs !== 0) throw new Error('Messages not deleted');

    console.log('[OK] Cascade deletion succeeded (User, UserSkill, ExchangeRequest, Room, Message all removed)');

    // 8. Bob is untouched
    const bobDoc = await User.findById(meB._id);
    if (!bobDoc) throw new Error('Bob was incorrectly deleted');
    console.log('[OK] Bob account untouched');

    // 9. Alice cookie invalidated
    const meRes2 = await axA.get('/auth/me');
    if (meRes2.status !== 401) throw new Error('Expected 401 using old Alice JWT');
    console.log('[OK] Alice JWT invalidated');

    console.log('\n--- ALL DELETE TESTS PASSED ---\n');
  } catch (err) {
    console.error('\n--- DELETE TEST FAILED ---');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (mongoose.connection) await mongoose.connection.close();
    if (replset) await replset.stop();
    process.exit(process.exitCode || 0);
  }
};

runTests();
