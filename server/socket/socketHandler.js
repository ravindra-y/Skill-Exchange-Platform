const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const Room = require('../models/Room');
const ExchangeRequest = require('../models/ExchangeRequest');
const Message = require('../models/Message');

/**
 * socketHandler sets up all Socket.io events.
 * Called once with the io instance after the HTTP server is created.
 */
module.exports = function setupSocket(io) {
  // ─── Auth middleware: runs before every connection ───────────────────────
  io.use(async (socket, next) => {
    try {
      // Parse cookies from the handshake headers
      const rawCookie = socket.handshake.headers.cookie || '';
      const cookies = cookie.parse(rawCookie);
      const token = cookies.jwt;

      if (!token) {
        return next(new Error('AUTH_NO_TOKEN'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId; // attach to socket for later use
      next();
    } catch (err) {
      next(new Error('AUTH_TOKEN_INVALID'));
    }
  });

  // ─── Tracks: roomId → Set of socketIds currently in the video room ───────
  const roomSockets = new Map(); // roomId → Set<socketId>

  io.on('connection', (socket) => {
    // ─── join-room (video room) ───────────────────────────────────────────
    socket.on('join-room', async ({ roomId }) => {
      try {
        if (!roomId) {
          socket.emit('room-error', { message: 'roomId is required' });
          return;
        }

        // 1. Look up the Room document
        const room = await Room.findById(roomId).populate('exchangeRequestId');
        if (!room || room.status !== 'active') {
          socket.emit('room-error', { message: 'Room not found or not active' });
          return;
        }

        // 2. Verify this user is one of the two participants
        const exchangeReq = room.exchangeRequestId;
        const senderId   = exchangeReq.senderId.toString();
        const receiverId = exchangeReq.receiverId.toString();

        if (socket.userId !== senderId && socket.userId !== receiverId) {
          socket.emit('room-error', { message: 'FORBIDDEN: you are not a participant in this room' });
          socket.disconnect(true);
          return;
        }

        // 3. Leave any previous video rooms this socket was in
        for (const r of socket.rooms) {
          if (r !== socket.id && !r.startsWith('chat:')) socket.leave(r);
        }

        // 4. Join the Socket.io video room
        socket.join(roomId);
        socket.currentRoomId = roomId;

        // 5. Track participants
        if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
        roomSockets.get(roomId).add(socket.id);

        // 6. Notify other user in the room
        socket.to(roomId).emit('peer-joined', { userId: socket.userId });

        // 7. Tell the joiner whether a peer is already present
        const peersInRoom = roomSockets.get(roomId).size;
        socket.emit('room-joined', {
          roomId,
          peerAlreadyPresent: peersInRoom > 1,
        });
      } catch (err) {
        console.error('[socket join-room error]', err);
        socket.emit('room-error', { message: 'Server error joining room' });
      }
    });

    // ─── WebRTC signaling ────────────────────────────────────────────────
    socket.on('signal', ({ roomId, data }) => {
      if (!roomId || socket.currentRoomId !== roomId) return;
      socket.to(roomId).emit('signal', { from: socket.userId, data });
    });

    // ─── Whiteboard sync ─────────────────────────────────────────────────
    socket.on('draw', ({ roomId, stroke }) => {
      if (!roomId || socket.currentRoomId !== roomId) return;
      socket.to(roomId).emit('draw', { stroke });
    });

    socket.on('whiteboard-clear', ({ roomId }) => {
      if (!roomId || socket.currentRoomId !== roomId) return;
      socket.to(roomId).emit('whiteboard-clear');
    });

    // ─── Leave / disconnect cleanup (video room) ──────────────────────────
    const handleLeave = () => {
      const roomId = socket.currentRoomId;
      if (!roomId) return;

      if (roomSockets.has(roomId)) {
        roomSockets.get(roomId).delete(socket.id);
        if (roomSockets.get(roomId).size === 0) {
          roomSockets.delete(roomId);
        }
      }

      socket.to(roomId).emit('peer-left', { userId: socket.userId });
      socket.currentRoomId = null;
    };

    socket.on('leave-room', handleLeave);
    socket.on('disconnect', handleLeave);

    // ════════════════════════════════════════════════════════════════════════
    // CHAT EVENTS — keyed by exchangeRequestId, independent of the video room
    // ════════════════════════════════════════════════════════════════════════

    // ─── chat:join ───────────────────────────────────────────────────────
    // Client calls this to subscribe to live messages for a conversation.
    // Does NOT require the user to be in the video room.
    socket.on('chat:join', async ({ exchangeRequestId }) => {
      try {
        if (!exchangeRequestId) {
          socket.emit('chat:error', { message: 'exchangeRequestId is required' });
          return;
        }

        const exReq = await ExchangeRequest.findById(exchangeRequestId);
        if (!exReq) {
          socket.emit('chat:error', { message: 'Exchange request not found' });
          return;
        }
        if (exReq.status !== 'accepted') {
          socket.emit('chat:error', { message: 'Exchange request is not accepted' });
          return;
        }

        const senderId   = exReq.senderId.toString();
        const receiverId = exReq.receiverId.toString();

        if (socket.userId !== senderId && socket.userId !== receiverId) {
          socket.emit('chat:error', { message: 'FORBIDDEN: not a participant' });
          return;
        }

        const chatRoom = 'chat:' + exchangeRequestId;
        socket.join(chatRoom);
        socket.emit('chat:joined', { exchangeRequestId });
      } catch (err) {
        console.error('[socket chat:join error]', err);
        socket.emit('chat:error', { message: 'Server error joining chat' });
      }
    });

    // ─── chat:send ───────────────────────────────────────────────────────
    // Primary path for sending a message in real time.
    // Persists to DB and broadcasts to the chat room.
    socket.on('chat:send', async ({ exchangeRequestId, text }) => {
      try {
        if (!exchangeRequestId || !text || !text.trim()) {
          socket.emit('chat:error', { message: 'exchangeRequestId and text are required' });
          return;
        }

        if (text.trim().length > 4000) {
          socket.emit('chat:error', { message: 'Message too long (max 4000 chars)' });
          return;
        }

        const exReq = await ExchangeRequest.findById(exchangeRequestId);
        if (!exReq) {
          socket.emit('chat:error', { message: 'Exchange request not found' });
          return;
        }
        if (exReq.status !== 'accepted') {
          socket.emit('chat:error', { message: 'Exchange request is not accepted' });
          return;
        }

        const senderId   = exReq.senderId.toString();
        const receiverId = exReq.receiverId.toString();

        if (socket.userId !== senderId && socket.userId !== receiverId) {
          socket.emit('chat:error', { message: 'FORBIDDEN: not a participant' });
          return;
        }

        // Persist first, then broadcast
        const message = await Message.create({
          exchangeRequestId,
          senderId: socket.userId,
          text: text.trim(),
        });

        const populated = await message.populate('senderId', 'name username');

        // Broadcast to all sockets in this chat room (including the sender's own socket)
        io.to('chat:' + exchangeRequestId).emit('chat:message', populated);
      } catch (err) {
        console.error('[socket chat:send error]', err);
        socket.emit('chat:error', { message: 'Server error sending message' });
      }
    });

    // ─── chat:typing ─────────────────────────────────────────────────────
    // Optional typing indicator — relays to the other participant only.
    socket.on('chat:typing', ({ exchangeRequestId, isTyping }) => {
      if (!exchangeRequestId) return;
      // Relay to others in the chat room (not back to the sender)
      socket.to('chat:' + exchangeRequestId).emit('chat:typing', {
        userId: socket.userId,
        isTyping: !!isTyping,
      });
    });
  });
};
