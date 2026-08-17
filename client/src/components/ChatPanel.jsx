import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from 'react';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import api from '../api/axios';
import { Send, Loader2, X, MessageSquare } from 'lucide-react';

/**
 * ChatPanel — lightweight chat panel for use inside the video Room.
 *
 * Props:
 *   exchangeRequestId  string  — the ExchangeRequest _id (from the Room)
 *   onClose            fn      — called when user clicks the × button
 */
export default function ChatPanel({ exchangeRequestId, onClose }) {
  const { user } = useContext(AuthContext);
  const { socket: socketRef, joinChat, markRead, sendMessage } = useChat();

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [typingPartner, setTypingPartner] = useState(false);

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const typingTimer = useRef(null);

  // ─── Load initial history ─────────────────────────────────────────────────
  useEffect(() => {
    if (!exchangeRequestId) return;
    const load = async () => {
      try {
        const { data } = await api.get(`/messages/${exchangeRequestId}?limit=30`);
        setMessages(data.messages);
        setHasMore(data.hasMore);
      } catch (_) {}
      finally { setLoading(false); }
    };
    load();
  }, [exchangeRequestId]);

  // ─── Join chat room + mark as read ───────────────────────────────────────
  useEffect(() => {
    if (!exchangeRequestId) return;
    joinChat(exchangeRequestId);
    markRead(exchangeRequestId);
    inputRef.current?.focus();
  }, [exchangeRequestId, joinChat, markRead]);

  // ─── Live socket subscription ─────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const onMessage = (msg) => {
      const msgExId = msg.exchangeRequestId?._id || msg.exchangeRequestId;
      if (msgExId !== exchangeRequestId) return;
      setMessages(prev => [...prev, msg]);
      markRead(exchangeRequestId);
    };

    const onTyping = ({ userId, isTyping }) => {
      if (userId === user?._id) return;
      setTypingPartner(isTyping);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [socketRef, exchangeRequestId, user, markRead]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Load older ───────────────────────────────────────────────────────────
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

  // ─── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      await sendMessage(exchangeRequestId, text);
    } catch (_) {
      setInput(text);
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

  const emitTyping = useCallback((isTyping) => {
    socketRef?.current?.emit('chat:typing', { exchangeRequestId, isTyping });
  }, [socketRef, exchangeRequestId]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white border-l border-gray-700">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          Chat
        </span>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition rounded"
          title="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full text-xs text-indigo-400 hover:text-indigo-300 py-1 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load earlier'}
          </button>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-gray-500 pt-6">No messages yet.</p>
        )}

        {messages.map(msg => {
          const senderId = msg.senderId?._id || msg.senderId;
          const isMe = senderId === user?._id;
          return (
            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm ${
                  isMe
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-100 rounded-bl-none'
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                <p className={`text-xs mt-0.5 text-right ${isMe ? 'text-indigo-300' : 'text-gray-400'}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}

        {typingPartner && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-xl rounded-bl-none px-3 py-1.5">
              <span className="text-xs text-gray-400 animate-pulse">typing…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex items-end gap-2 px-3 py-2 bg-gray-800 border-t border-gray-700">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter)"
          className="flex-1 resize-none bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 max-h-28 overflow-y-auto"
          style={{ minHeight: '38px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition shrink-0"
        >
          {sending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
