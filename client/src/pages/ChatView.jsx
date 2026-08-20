import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import api from '../api/axios';
import { ArrowLeft, Send, Loader2, MessageSquare, Video, Trash2 } from 'lucide-react';

export default function ChatView() {
  const { exchangeRequestId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { socket: socketRef, joinChat, markRead, sendMessage } = useChat();

  const [messages, setMessages]       = useState([]);
  const [hasMore, setHasMore]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError]   = useState('');
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const typingTimer = useRef(null);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get(`/messages/${exchangeRequestId}?limit=30`);
        setMessages(data.messages);
        setHasMore(data.hasMore);

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

  // ─── Join chat socket room, mark as read ──────────────────────────────────
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

  // ─── Auto-scroll to bottom on new messages ────────────────────────────────
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
    } catch (err) {
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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleDeleteChat = async () => {
    if (!window.confirm('Are you sure you want to delete this conversation? This will delete all messages for both participants.')) {
      return;
    }
    try {
      await api.delete(`/messages/${exchangeRequestId}`);
      navigate('/conversations');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete conversation');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (initialLoading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
      <span className="ml-3 text-sm text-brand-muted">Loading conversation…</span>
    </div>
  );

  if (fetchError) return (
    <div className="w-full max-w-2xl mx-auto px-6 py-10">
      <div className="px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
        {fetchError}
      </div>
    </div>
  );

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
    <div className="flex flex-col h-[calc(100vh-70px)] bg-brand-surface-2">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-surface border-b border-black/[0.08] shrink-0">
        <Link to="/conversations" className="text-brand-muted hover:text-brand-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-8 h-8 rounded-full bg-brand-surface-2 border border-black/[0.08] flex items-center justify-center shrink-0">
          <span className="text-xs font-medium text-brand-muted">
            {(partnerName || '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-brand-text leading-tight">{partnerName}</p>
          {typingUsers.size > 0 && (
            <p className="text-xs text-brand-muted animate-pulse">typing…</p>
          )}
        </div>
        
        {/* Actions */}
        <button
          onClick={() => navigate(`/room/${exchangeRequestId}`)}
          title="Start Video Call"
          className="p-1.5 text-brand-muted hover:text-brand-text transition-colors"
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          onClick={handleDeleteChat}
          title="Delete Conversation"
          className="p-1.5 text-brand-muted hover:text-status-error transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {hasMore && (
          <div className="flex justify-center mb-4 mt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-brand-muted hover:text-brand-text transition-colors underline underline-offset-2 disabled:opacity-50"
            >
              {loadingMore
                ? <><Loader2 className="w-3 h-3 animate-spin inline mr-1" />Loading…</>
                : 'Load earlier messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <MessageSquare className="w-8 h-8 text-brand-line mb-3" />
            <p className="text-sm text-brand-muted">No messages yet.</p>
            <p className="text-xs text-brand-faint mt-1">Send the first message below.</p>
          </div>
        )}

        {grouped.map((item, index) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="flex items-center gap-3 py-4 mt-2">
                <div className="flex-1 h-px bg-brand-line/40" />
                <span className="text-[11px] font-medium text-brand-faint uppercase tracking-wider shrink-0">{item.label}</span>
                <div className="flex-1 h-px bg-brand-line/40" />
              </div>
            );
          }

          const { msg } = item;
          const senderId = msg.senderId?._id || msg.senderId;
          const isMe = senderId === user?._id;

          const prevItem = index > 0 ? grouped[index - 1] : null;
          const prevSenderId = prevItem?.type === 'msg' ? (prevItem.msg.senderId?._id || prevItem.msg.senderId) : null;
          const isSameSenderAsPrev = prevSenderId === senderId;

          const nextItem = index < grouped.length - 1 ? grouped[index + 1] : null;
          const nextSenderId = nextItem?.type === 'msg' ? (nextItem.msg.senderId?._id || nextItem.msg.senderId) : null;
          const isSameSenderAsNext = nextSenderId === senderId;

          const marginTop = isSameSenderAsPrev ? 'mt-1' : 'mt-5';

          return (
            <div
              key={item.key}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${marginTop}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[65%] px-4 py-2.5 rounded-[12px] text-sm leading-relaxed ${
                  isMe
                    ? `bg-brand-text text-brand-bg ${isSameSenderAsNext ? 'rounded-br-[4px]' : 'rounded-br-[12px]'} ${isSameSenderAsPrev ? 'rounded-tr-[4px]' : 'rounded-tr-[12px]'}`
                    : `bg-brand-surface border border-black/[0.08] text-brand-text shadow-sm ${isSameSenderAsNext ? 'rounded-bl-[4px]' : 'rounded-bl-[12px]'} ${isSameSenderAsPrev ? 'rounded-tl-[4px]' : 'rounded-tl-[12px]'}`
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                {!isSameSenderAsNext && (
                  <p className={`text-[10px] mt-1.5 text-right font-medium tracking-tight ${isMe ? 'text-brand-bg/50' : 'text-brand-faint'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-brand-surface border-t border-black/[0.08] px-4 py-3 flex items-end gap-3">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none bg-brand-surface-2 border border-black/[0.10] rounded-[8px] px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-faint focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 max-h-32 overflow-y-auto transition-colors"
          style={{ minHeight: '44px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="p-2.5 bg-brand-text hover:brightness-[1.08] disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg rounded-[8px] transition-all shrink-0"
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
