import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import api from '../api/axios';

const SOCKET_URL = 'http://localhost:5000';

export const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useContext(AuthContext);

  // socket is shared across standalone chat and the in-room panel
  const socketRef = useRef(null);

  // unreadCounts: { [exchangeRequestId]: number }
  const [unreadCounts, setUnreadCounts] = useState({});

  // Which chat rooms this socket has joined so we don't re-join on re-render
  const joinedRooms = useRef(new Set());

  // ─── Fetch initial unread counts from REST ────────────────────────────────
  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/messages/unread/counts');
      setUnreadCounts(data);
    } catch (err) {
      // Silently ignore — unread counts are non-critical
    }
  }, [user]);

  // ─── Connect socket and set up global chat:message listener ──────────────
  useEffect(() => {
    if (!user) return;

    fetchUnreadCounts();

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    // When any chat message arrives, increment the unread count for that
    // conversation unless the user is currently viewing it (handled by markRead)
    socket.on('chat:message', (msg) => {
      const exId = msg.exchangeRequestId?._id || msg.exchangeRequestId;
      // We always increment here; markRead() will zero it out when the user
      // opens the conversation. The sender's own messages don't need a badge
      // but since the server broadcasts to the whole chat room (including sender),
      // we skip incrementing for our own messages.
      if (msg.senderId?._id !== user._id && msg.senderId !== user._id) {
        setUnreadCounts(prev => ({
          ...prev,
          [exId]: (prev[exId] || 0) + 1,
        }));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedRooms.current.clear();
    };
  }, [user, fetchUnreadCounts]);

  // ─── Join a chat room (idempotent) ────────────────────────────────────────
  const joinChat = useCallback((exchangeRequestId) => {
    if (!exchangeRequestId || !socketRef.current) return;
    if (joinedRooms.current.has(exchangeRequestId)) return;
    socketRef.current.emit('chat:join', { exchangeRequestId });
    joinedRooms.current.add(exchangeRequestId);
  }, []);

  // ─── Mark a conversation as read (clears the badge) ──────────────────────
  const markRead = useCallback(async (exchangeRequestId) => {
    setUnreadCounts(prev => ({ ...prev, [exchangeRequestId]: 0 }));
    try {
      await api.post(`/messages/${exchangeRequestId}/read`);
    } catch (_) {}
  }, []);

  // ─── Send a message (socket primary, REST fallback) ───────────────────────
  const sendMessage = useCallback(async (exchangeRequestId, text) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit('chat:send', { exchangeRequestId, text });
    } else {
      // Fallback to REST if socket is disconnected
      const { data } = await api.post(`/messages/${exchangeRequestId}`, { text });
      return data;
    }
  }, []);

  // ─── Total unread across all conversations (for nav badge) ────────────────
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  return (
    <ChatContext.Provider
      value={{
        socket: socketRef,
        unreadCounts,
        totalUnread,
        joinChat,
        markRead,
        sendMessage,
        fetchUnreadCounts,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
