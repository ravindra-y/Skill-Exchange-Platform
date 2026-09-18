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
  const [chatContext, setChatContext] = useState('');
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
          const amISender = req.senderId?._id === user?._id || req.senderId === user?._id;
          const partner = amISender ? req.receiverId : req.senderId;
          setPartnerName(partner?.name || 'Partner');

          if (req.requestedSkillId?.name && req.offeredSkillId?.name) {
            const myTeach = amISender ? req.offeredSkillId.name : req.requestedSkillId.name;
            const myLearn = amISender ? req.requestedSkillId.name : req.offeredSkillId.name;
            setChatContext(`Swapping ${myTeach} for ${myLearn}`);
          } else {
            setChatContext('Skill Exchange');
          }
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
    <div className="flex justify-center h-[calc(100vh-70px)] bg-brand-surface-2">
      <div className="flex flex-col w-full max-w-4xl bg-brand-bg shadow-sm border-x border-black/[0.08]">
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-3 bg-brand-surface border-b border-black/[0.08] shrink-0">
          <Link to="/conversations" className="text-brand-muted hover:text-brand-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-black/[0.08] flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-brand-muted">
              {(partnerName || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-medium text-brand-text leading-tight">{partnerName}</p>
            {typingUsers.size > 0 ? (
              <p className="text-[13px] text-brand-muted animate-pulse mt-0.5">typing…</p>
            ) : (
              <p className="text-[13px] text-brand-muted mt-0.5">{chatContext}</p>
            )}
          </div>
          
          {/* Actions */}
          <button
            onClick={() => navigate(`/room/${exchangeRequestId}`)}
            title="Start Video Call"
            className="p-2 text-brand-muted hover:text-brand-text transition-colors rounded-full hover:bg-black/[0.05]"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={handleDeleteChat}
            title="Delete Conversation"
            className="p-2 text-brand-muted hover:text-status-error transition-colors rounded-full hover:bg-status-error/10"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-brand-bg">
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
                  <div className="flex-1 h-px bg-black/[0.06]" />
                  <span className="text-[11px] font-medium text-brand-muted uppercase tracking-wider shrink-0">{item.label}</span>
                  <div className="flex-1 h-px bg-black/[0.06]" />
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

            const marginTop = isSameSenderAsPrev ? 'mt-1.5' : 'mt-6';

            return (
              <div
                key={item.key}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${marginTop}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                    isMe
                      ? `bg-brand-text text-brand-bg ${isSameSenderAsNext ? 'rounded-br-[6px]' : 'rounded-br-[18px]'} ${isSameSenderAsPrev ? 'rounded-tr-[6px]' : 'rounded-tr-[18px]'} rounded-l-[18px]`
                      : `bg-brand-surface border border-black/[0.06] text-brand-text ${isSameSenderAsNext ? 'rounded-bl-[6px]' : 'rounded-bl-[18px]'} ${isSameSenderAsPrev ? 'rounded-tl-[6px]' : 'rounded-tl-[18px]'} rounded-r-[18px]`
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  {!isSameSenderAsNext && (
                    <p className={`text-[10px] mt-1.5 text-right font-medium tracking-tight ${isMe ? 'text-brand-bg/60' : 'text-brand-muted'}`}>
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
        <div className="shrink-0 bg-brand-surface border-t border-black/[0.08] px-5 py-4 flex items-end gap-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            className="flex-1 resize-none bg-brand-surface-2 border border-black/[0.10] rounded-[16px] px-4 py-3 text-[15px] text-brand-text placeholder:text-brand-faint focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 max-h-32 overflow-y-auto transition-colors"
            style={{ minHeight: '48px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-3 bg-brand-text hover:brightness-[1.08] disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg rounded-full transition-all shrink-0 shadow-sm"
            title="Send message"
          >
            {sending
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
