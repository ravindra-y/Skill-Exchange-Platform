import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import api from '../api/axios';
import {
  ArrowLeft, Send, Loader2, MessageSquare,
} from 'lucide-react';

export default function ChatView() {
  const { exchangeRequestId } = useParams();
  const { user } = useContext(AuthContext);
  const { socket: socketRef, joinChat, markRead, sendMessage } = useChat();

  const [messages, setMessages]   = useState([]);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const typingTimer = useRef(null);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Load initial history (most recent 30 messages)
        const { data } = await api.get(`/messages/${exchangeRequestId}?limit=30`);
        setMessages(data.messages);
        setHasMore(data.hasMore);

        // Derive partner name from exchange request participants
        const { data: exData } = await api.get('/exchange');
        const all = [...exData.sent, ...exData.received];
        const req = all.find(r => r._id === exchangeRequestId);
        if (req) {
          const partner =
            req.senderId?._id === user?._id || req.senderId === user?._id
              ? req.receiverId
              : req.senderId;
          setPartnerName(partner?.name || 'Partner');
        }
      } catch (err) {
        setFetchError(err.response?.data?.message || 'Failed to load conversation.');
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, [exchangeRequestId, user]);

  // ─── Join chat socket room, mark as read ─────────────────────────────────
  useEffect(() => {
    joinChat(exchangeRequestId);
    markRead(exchangeRequestId);
    inputRef.current?.focus();
  }, [exchangeRequestId, joinChat, markRead]);

  // ─── Live message subscription ────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const onMessage = (msg) => {
      const msgExId = msg.exchangeRequestId?._id || msg.exchangeRequestId;
      if (msgExId !== exchangeRequestId) return;
      setMessages(prev => [...prev, msg]);
      // Mark as read immediately since the user is in this view
      markRead(exchangeRequestId);
    };

    const onTyping = ({ userId, isTyping }) => {
      if (userId === user?._id) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [socketRef, exchangeRequestId, user, markRead]);

  // ─── Auto-scroll to bottom on new messages ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Load older messages ──────────────────────────────────────────────────
  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0].createdAt;
      const { data } = await api.get(
        `/messages/${exchangeRequestId}?limit=30&before=${encodeURIComponent(oldest)}`
      );
      setMessages(prev => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
    } catch (_) {}
    finally { setLoadingMore(false); }
  };

  // ─── Send a message ───────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      await sendMessage(exchangeRequestId, text);
      // If socket delivered it, the chat:message event will append it.
      // If REST fallback was used, sendMessage() returns the persisted message
      // but we let the server emit handle deduplication via socket.
    } catch (err) {
      setInput(text); // restore on failure
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Typing indicator ─────────────────────────────────────────────────────
  const emitTyping = useCallback((isTyping) => {
    socketRef?.current?.emit('chat:typing', { exchangeRequestId, isTyping });
  }, [socketRef, exchangeRequestId]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  };

  // ─── Format timestamp ─────────────────────────────────────────────────────
  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="loading-page">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600 font-medium">Loading conversation…</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {fetchError}
        </div>
      </div>
    );
  }

  // Group messages by date
  const grouped = [];
  let lastDate = null;
  for (const msg of messages) {
    const dateLabel = formatDate(msg.createdAt);
    if (dateLabel !== lastDate) {
      grouped.push({ type: 'date', label: dateLabel, key: `date-${msg.createdAt}` });
      lastDate = dateLabel;
    }
    grouped.push({ type: 'msg', msg, key: msg._id });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white shadow-sm border-b border-gray-200 shrink-0">
        <Link to="/conversations" className="text-gray-500 hover:text-indigo-600 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-indigo-700 font-semibold">
            {(partnerName || '?')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 leading-tight">{partnerName}</p>
          {typingUsers.size > 0 && (
            <p className="text-xs text-indigo-500 animate-pulse">typing…</p>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
            >
              {loadingMore
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                : 'Load earlier messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center py-16">
            <div className="empty-state w-full max-w-sm mx-auto border-none bg-transparent">
              <MessageSquare className="empty-state-icon" />
              <span className="empty-state-text">No messages yet.</span>
              <span className="empty-state-subtext">Send the first message below.</span>
            </div>
          </div>
        )}

        {grouped.map(item => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 shrink-0">{item.label}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            );
          }

          const { msg } = item;
          const senderId = msg.senderId?._id || msg.senderId;
          const isMe = senderId === user?._id;

          return (
            <div
              key={item.key}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}
            >
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isMe
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                <p className={`text-xs mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-3">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent max-h-32 overflow-y-auto"
          style={{ minHeight: '44px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition shrink-0"
          title="Send message"
        >
          {sending
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
