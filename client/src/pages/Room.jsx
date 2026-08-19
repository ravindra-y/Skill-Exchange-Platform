import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  ArrowLeft, Pencil, Eraser, Trash2, Wifi, WifiOff,
  Loader2, Circle, Download, LayoutDashboard, MessageSquare,
  Square, Circle as CircleIcon, Minus, ArrowUpRight, Type, MousePointer2, Image as ImageIcon,
  Undo, Redo, Maximize, Minimize, History, Delete, XSquare
} from 'lucide-react';
import ChatPanel from '../components/ChatPanel';

const SOCKET_URL = 'http://localhost:5000';

const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ffffff'];

// ═══════════════════════════════════════════════════════════════════════════════
// Session Complete Screen — shown after leaving the room
// ═══════════════════════════════════════════════════════════════════════════════
function SessionComplete({ partnerName, durationSecs, recordingBlob }) {
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleDownload = () => {
    if (!recordingBlob) return;
    const url  = URL.createObjectURL(recordingBlob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `session-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg px-6">
      <div className="bg-brand-surface border border-black/[0.08] rounded-[8px] p-10 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-brand-surface-2 border border-black/[0.08] rounded-full flex items-center justify-center mx-auto mb-6">
          <Wifi className="w-8 h-8 text-brand-muted" />
        </div>

        <h1 className="text-2xl font-medium tracking-tight text-brand-text mb-2">Session complete</h1>
        <p className="text-sm text-brand-muted mb-8">
          Great session with <span className="font-medium text-brand-text">{partnerName || 'your partner'}</span>!
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-brand-surface-2 rounded-[8px] p-4 text-center">
            <p className="text-xs uppercase tracking-label text-brand-muted mb-1">Duration</p>
            <p className="text-xl font-medium text-brand-text font-mono">{formatTime(durationSecs)}</p>
          </div>
          <div className="bg-brand-surface-2 rounded-[8px] p-4 text-center">
            <p className="text-xs uppercase tracking-label text-brand-muted mb-1">Recording</p>
            <p className="text-xl font-medium text-brand-text">{recordingBlob ? '✓ Ready' : '—'}</p>
          </div>
        </div>

        {/* Download recording */}
        {recordingBlob && (
          <button
            onClick={handleDownload}
            className="btn-primary w-full mb-3"
          >
            <Download className="w-4 h-4" />
            Download Recording (.webm)
          </button>
        )}

        {/* Back to dashboard */}
        <Link
          to="/dashboard"
          className="btn-secondary w-full justify-center"
        >
          <LayoutDashboard className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Room component
// ═══════════════════════════════════════════════════════════════════════════════
export default function Room() {
  const { id: exchangeRequestId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate  = useNavigate();

  // ── Room resolution ────────────────────────────────────────────────────────
  const [roomId, setRoomId]           = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError]     = useState(null);
  const [partnerName, setPartnerName] = useState('');

  // ── Session-complete screen ────────────────────────────────────────────────
  const [sessionDone, setSessionDone]         = useState(false);
  const [finalDuration, setFinalDuration]     = useState(0);
  const [recordingBlob, setRecordingBlob]     = useState(null);

  // ── WebRTC / media state ───────────────────────────────────────────────────
  const [micOn, setMicOn]               = useState(false);
  const [camOn, setCamOn]               = useState(false);
  const [peerStatus, setPeerStatus]     = useState('waiting');
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [mediaError, setMediaError]     = useState(null);

  // ── Recording state ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording]   = useState(false);

  // ── Chat panel state ───────────────────────────────────────────────────────
  const [chatOpen, setChatOpen]         = useState(false);

  // ── Session timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const timerRef              = useRef(null);

  // ── Whiteboard state ───────────────────────────────────────────────────────
  const [tool, setTool]               = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing]     = useState(false);
  const [images, setImages]           = useState([]);
  const [textCursor, setTextCursor]   = useState(null);
  const [textValue, setTextValue]     = useState('');
  const [canUndo, setCanUndo]         = useState(false);
  const [canRedo, setCanRedo]         = useState(false);
  const [deletedImages, setDeletedImages] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDeletedPanel, setShowDeletedPanel] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef     = useRef(null);
  const globalActionLog  = useRef([]);
  const localUndoStack   = useRef([]);
  const currentActionId  = useRef(null);
  const currentPath      = useRef(null);
  const localVideoRef    = useRef(null);
  const remoteVideoRef   = useRef(null);
  const pcRef            = useRef(null);
  const localStreamRef   = useRef(null);
  const remoteStreamRef  = useRef(null);
  const audioSenderRef   = useRef(null);
  const videoSenderRef   = useRef(null);
  const socketRef        = useRef(null);
  const canvasRef        = useRef(null);
  const ctxRef           = useRef(null);
  const lastPoint        = useRef(null);
  const isMakingOffer    = useRef(false);
  const roomIdRef        = useRef(null);

  // Whiteboard new feature refs
  const previewImageData = useRef(null);
  const draggingImage    = useRef(null);
  const resizingImage    = useRef(null);
  const fileInputRef     = useRef(null);

  // Recording refs
  const mediaRecorderRef  = useRef(null);
  const recordedChunks    = useRef([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Resolve Room document from the exchange-request id
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const resolveRoom = async () => {
      try {
        const { data: room } = await api.get(`/rooms/by-exchange/${exchangeRequestId}`);
        setRoomId(room._id);
        roomIdRef.current = room._id;

        // Determine partner name from the populated ExchangeRequest
        const exReq = room.exchangeRequestId;
        if (exReq && user) {
          const isSender = exReq.senderId?._id === user._id || exReq.senderId === user._id;
          const partner  = isSender ? exReq.receiverId : exReq.senderId;
          setPartnerName(partner?.name || '');
        }
      } catch (err) {
        setRoomError(err.response?.data?.message || 'Room not found or you are not a participant.');
      } finally {
        setRoomLoading(false);
      }
    };
    resolveRoom();
  }, [exchangeRequestId, user]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Init media → WebRTC → Socket.io
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const start = async () => {
      // 2a. Init empty local media
      localStreamRef.current = new MediaStream();
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

      // 2b. Socket.io
      const socket = io(SOCKET_URL, {
        withCredentials: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setSocketStatus('connected');
        socket.emit('join-room', { roomId: roomIdRef.current });
      });
      socket.on('connect_error', () => setSocketStatus('error'));
      socket.on('disconnect',    () => setSocketStatus('connecting'));

      // 2c. Room events
      socket.on('room-error', ({ message }) => setRoomError(message));
      socket.on('room-joined', ({ peerAlreadyPresent }) => {
        if (peerAlreadyPresent) createOffer(socket);
      });
      socket.on('peer-joined', () => setPeerStatus('waiting'));
      socket.on('peer-left',   () => {
        setPeerStatus('disconnected');
        cleanupPeerConnection();
        stopTimer();
      });

      // 2d. WebRTC signaling
      socket.on('signal', async ({ data }) => {
        if (data.type === 'offer')        await handleOffer(data, socket);
        else if (data.type === 'answer')  await handleAnswer(data);
        else if (data.candidate)          await addIceCandidate(data);
      });

      // 2e. Whiteboard
      socket.on('draw', ({ stroke, actionId, userId }) => {
        let action = globalActionLog.current.find(a => a.id === actionId);
        if (!action) {
          action = { id: actionId, userId, type: 'path', data: [] };
          addActionToLog(action);
        }
        action.data.push(stroke);
        if (!action.isUndone) { if (ctxRef.current) applyStroke(ctxRef.current, stroke); }
      });
      socket.on('draw-shape', ({ shape, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'shape', data: shape });
        renderCanvasFromLog();
      });
      socket.on('draw-text', ({ textObj, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'text', data: textObj });
        renderCanvasFromLog();
      });
      socket.on('image-add', ({ image, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'image-add', data: image });
        renderCanvasFromLog();
      });
      socket.on('image-update', ({ update, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'image-update', data: update });
        renderCanvasFromLog();
      });
      socket.on('delete-image', ({ targetId, image, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'delete-image', targetId, image });
        renderCanvasFromLog();
      });
      socket.on('whiteboard-delete-element', ({ targetId, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'delete-element', targetId });
        renderCanvasFromLog();
      });
      socket.on('whiteboard-permanent-delete', ({ targetId, actionId, userId }) => {
        addActionToLog({ id: actionId, userId, type: 'permanent-delete', targetId });
        renderCanvasFromLog();
      });
      socket.on('whiteboard-clear', ({ actionId, userId }) => {
        addActionToLog({ id: actionId || Date.now().toString(), userId, type: 'clear' });
        renderCanvasFromLog();
      });
      socket.on('whiteboard-undo', ({ actionId }) => {
        const action = globalActionLog.current.find(a => a.id === actionId);
        if (action) { action.isUndone = true; renderCanvasFromLog(); updateUndoRedoState(); }
      });
      socket.on('whiteboard-redo', ({ actionId }) => {
        const action = globalActionLog.current.find(a => a.id === actionId);
        if (action) { action.isUndone = false; renderCanvasFromLog(); updateUndoRedoState(); }
      });
    };

    start();
    return () => { cancelled = true; leaveRoom(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. WebRTC helpers
  // ═══════════════════════════════════════════════════════════════════════════
  const buildPeerConnection = (socket) => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    audioSenderRef.current = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    videoSenderRef.current = pc.addTransceiver('video', { direction: 'sendrecv' }).sender;

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      setPeerStatus('connected');
      startTimer();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal', { roomId: roomIdRef.current, data: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeerStatus('disconnected');
        stopTimer();
      }
      if (pc.connectionState === 'connected') setPeerStatus('connected');
    };

    return pc;
  };

  const createOffer = async (socket) => {
    if (isMakingOffer.current) return;
    isMakingOffer.current = true;
    try {
      const pc    = buildPeerConnection(socket);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { roomId: roomIdRef.current, data: pc.localDescription });
    } catch (err) {
      console.error('[createOffer]', err);
    } finally {
      isMakingOffer.current = false;
    }
  };

  const handleOffer = async (offer, socket) => {
    try {
      const pc = buildPeerConnection(socket);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', { roomId: roomIdRef.current, data: pc.localDescription });
    } catch (err) {
      console.error('[handleOffer]', err);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      if (pcRef.current && pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error('[handleAnswer]', err);
    }
  };

  const addIceCandidate = async (candidate) => {
    try {
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('[addIceCandidate]', err);
    }
  };

  const cleanupPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.ontrack        = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Timer
  // ═══════════════════════════════════════════════════════════════════════════
  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };
  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Media controls
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleMic = async () => {
    if (micOn) {
      // Turn off
      if (!localStreamRef.current) return;
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.stop();
        localStreamRef.current.removeTrack(track);
        if (audioSenderRef.current) {
          try { await audioSenderRef.current.replaceTrack(null); } catch (err) { console.error(err); }
        }
      }
      setMicOn(false);
    } else {
      // Turn on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = stream.getAudioTracks()[0];
        if (!localStreamRef.current) localStreamRef.current = new MediaStream();
        localStreamRef.current.addTrack(newTrack);
        if (audioSenderRef.current) {
          try { await audioSenderRef.current.replaceTrack(newTrack); } catch (err) { console.error(err); }
        }
        setMicOn(true);
        setMediaError(null);
      } catch (err) {
        setMediaError(err.name === 'NotAllowedError' ? 'Mic permission denied.' : 'Could not access mic.');
      }
    }
  };

  const toggleCam = async () => {
    if (camOn) {
      // Turn off
      if (!localStreamRef.current) return;
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.stop();
        localStreamRef.current.removeTrack(track);
        if (videoSenderRef.current) {
          try { await videoSenderRef.current.replaceTrack(null); } catch (err) { console.error(err); }
        }
      }
      setCamOn(false);
    } else {
      // Turn on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = stream.getVideoTracks()[0];
        if (!localStreamRef.current) localStreamRef.current = new MediaStream();
        localStreamRef.current.addTrack(newTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        if (videoSenderRef.current) {
          try { await videoSenderRef.current.replaceTrack(newTrack); } catch (err) { console.error(err); }
        }
        setCamOn(true);
        setMediaError(null);
      } catch (err) {
        setMediaError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not access camera.');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Recording (MediaRecorder — browser only, no backend)
  // ═══════════════════════════════════════════════════════════════════════════
  const startRecording = () => {
    // Merge local + remote streams into a single MediaStream for recording
    const tracks = [];
    if (localStreamRef.current)  localStreamRef.current.getTracks().forEach(t  => tracks.push(t));
    if (remoteStreamRef.current) remoteStreamRef.current.getTracks().forEach(t => tracks.push(t));

    if (tracks.length === 0) {
      alert('No media tracks available to record. Start the camera first.');
      return;
    }

    const combinedStream = new MediaStream(tracks);

    // Pick best supported MIME type
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    let mr;
    try {
      mr = new MediaRecorder(combinedStream, { mimeType });
    } catch (e) {
      alert(`Cannot start recording: ${e.message}`);
      return;
    }

    recordedChunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: mimeType });
      setRecordingBlob(blob);
      setIsRecording(false);
    };

    mr.start(1000); // collect chunks every 1 s
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Leave / cleanup
  // ═══════════════════════════════════════════════════════════════════════════
  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    const onUnload = () => {
      cleanupMedia();
      if (socketRef.current) {
        socketRef.current.emit('leave-room', { roomId: roomIdRef.current });
        socketRef.current.disconnect();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [cleanupMedia]);

  const leaveRoom = useCallback(() => {
    stopTimer();
    // Stop recording if active; onstop will fire and set the blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    cleanupMedia();
    cleanupPeerConnection();
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId: roomIdRef.current });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [cleanupMedia]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleLeave = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const duration = elapsed;
    // Stop recording first so the blob is ready before we render SessionComplete
    if (isRecording) stopRecording();
    leaveRoom();
    stopTimer();
    setFinalDuration(duration);
    setSessionDone(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Whiteboard
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas  = canvasRef.current;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    const handleResize = () => {
      const img = new Image();
      img.src    = canvas.toDataURL();
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      img.onload = () => ctx.drawImage(img, 0, 0);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [roomId]);

  const getCanvasPos = (e) => {
    const rect    = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const applyStroke = (ctx, stroke) => {
    ctx.beginPath();
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth   = stroke.width;
    ctx.moveTo(stroke.x0, stroke.y0);
    ctx.lineTo(stroke.x1, stroke.y1);
    ctx.stroke();
  };

  const applyShape = (ctx, shape) => {
    ctx.beginPath();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    
    if (shape.type === 'rect') {
      ctx.strokeRect(shape.x0, shape.y0, shape.x1 - shape.x0, shape.y1 - shape.y0);
    } else if (shape.type === 'circle') {
      const rx = (shape.x1 - shape.x0) / 2;
      const ry = (shape.y1 - shape.y0) / 2;
      const cx = shape.x0 + rx;
      const cy = shape.y0 + ry;
      ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'line') {
      ctx.moveTo(shape.x0, shape.y0);
      ctx.lineTo(shape.x1, shape.y1);
      ctx.stroke();
    } else if (shape.type === 'arrow') {
      ctx.moveTo(shape.x0, shape.y0);
      ctx.lineTo(shape.x1, shape.y1);
      ctx.stroke();
      const angle = Math.atan2(shape.y1 - shape.y0, shape.x1 - shape.x0);
      const headlen = 15;
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x1 - headlen * Math.cos(angle - Math.PI / 6), shape.y1 - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(shape.x1 - headlen * Math.cos(angle + Math.PI / 6), shape.y1 - headlen * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(shape.x1, shape.y1);
      ctx.fillStyle = shape.color;
      ctx.fill();
    }
  };

  const applyText = (ctx, textObj) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = textObj.color;
    ctx.font = '16px Inter, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(textObj.text, textObj.x, textObj.y);
  };

  const hitTest = (pos, action) => {
    if (action.type === 'path') {
      const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const distToSegment = (p, v, w) => {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return dist(p, v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
      };
      for (const stroke of action.data) {
        if (distToSegment(pos, { x: stroke.x0, y: stroke.y0 }, { x: stroke.x1, y: stroke.y1 }) <= (stroke.width / 2) + 5) {
          return true;
        }
      }
      return false;
    }
    if (action.type === 'shape') {
      const s = action.data;
      if (s.type === 'line' || s.type === 'arrow') {
        const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const l2 = (s.x0 - s.x1) ** 2 + (s.y0 - s.y1) ** 2;
        let t = 0;
        if (l2 !== 0) {
          t = ((pos.x - s.x0) * (s.x1 - s.x0) + (pos.y - s.y0) * (s.y1 - s.y0)) / l2;
          t = Math.max(0, Math.min(1, t));
        }
        const proj = { x: s.x0 + t * (s.x1 - s.x0), y: s.y0 + t * (s.y1 - s.y0) };
        return dist(pos, proj) <= (s.width / 2) + 5;
      }
      if (s.type === 'rect') {
        const minX = Math.min(s.x0, s.x1) - 5;
        const maxX = Math.max(s.x0, s.x1) + 5;
        const minY = Math.min(s.y0, s.y1) - 5;
        const maxY = Math.max(s.y0, s.y1) + 5;
        return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
      }
      if (s.type === 'circle') {
        const rx = Math.abs(s.x1 - s.x0) / 2;
        const ry = Math.abs(s.y1 - s.y0) / 2;
        const cx = Math.min(s.x0, s.x1) + rx;
        const cy = Math.min(s.y0, s.y1) + ry;
        const val = ((pos.x - cx) ** 2) / ((rx + 5) ** 2) + ((pos.y - cy) ** 2) / ((ry + 5) ** 2);
        return val <= 1;
      }
    }
    if (action.type === 'text') {
      const t = action.data;
      if (ctxRef.current) {
        ctxRef.current.font = '16px Inter, sans-serif';
        const m = ctxRef.current.measureText(t.text);
        const w = m.width;
        const h = 20;
        return pos.x >= t.x - 5 && pos.x <= t.x + w + 5 && pos.y >= t.y - 5 && pos.y <= t.y + h + 5;
      }
    }
    return false;
  };

  const updateUndoRedoState = () => {
    const ownActions = globalActionLog.current.filter(a => a.userId === user._id && !a.isUndone);
    setCanUndo(ownActions.length > 0);
    setCanRedo(localUndoStack.current.length > 0);
  };

  const addActionToLog = (action) => {
    globalActionLog.current.push(action);
    if (globalActionLog.current.length > 1000) globalActionLog.current.shift();
    updateUndoRedoState();
  };

  const renderCanvasFromLog = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    let activeImagesMap = new Map();
    let deletedImagesMap = new Map();
    let deletedObjectsSet = new Set();
    let permanentDeletedSet = new Set();

    globalActionLog.current.forEach(action => {
      if (action.isUndone) return;
      if (action.type === 'permanent-delete') {
        permanentDeletedSet.add(action.targetId);
      } else if (action.type === 'delete-element' || action.type === 'delete-image') {
        deletedObjectsSet.add(action.targetId);
      }
    });

    globalActionLog.current.forEach(action => {
      if (action.isUndone) return;
      if (action.type === 'clear') {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        activeImagesMap.clear();
      } else if (['path', 'shape', 'text'].includes(action.type)) {
        if (!deletedObjectsSet.has(action.id) && !permanentDeletedSet.has(action.id)) {
          if (action.type === 'path') {
            action.data.forEach(stroke => applyStroke(ctx, stroke));
          } else if (action.type === 'shape') {
            applyShape(ctx, action.data);
          } else if (action.type === 'text') {
            applyText(ctx, action.data);
          }
        }
      } else if (action.type === 'image-add') {
        if (!permanentDeletedSet.has(action.data.id)) {
          activeImagesMap.set(action.data.id, action.data);
          deletedImagesMap.delete(action.data.id);
        }
      } else if (action.type === 'delete-image' || action.type === 'delete-element') {
        if (permanentDeletedSet.has(action.targetId)) return;
        if (activeImagesMap.has(action.targetId)) {
          deletedImagesMap.set(action.targetId, activeImagesMap.get(action.targetId));
          activeImagesMap.delete(action.targetId);
        } else if (action.image) {
          deletedImagesMap.set(action.targetId, action.image);
        }
      } else if (action.type === 'image-update') {
        if (permanentDeletedSet.has(action.data.id)) return;
        if (activeImagesMap.has(action.data.id)) {
          const img = activeImagesMap.get(action.data.id);
          activeImagesMap.set(action.data.id, { ...img, ...action.data });
        }
      }
    });

    setImages(Array.from(activeImagesMap.values()));
    setDeletedImages(Array.from(deletedImagesMap.values()).reverse());
  };

  const handleUndo = () => {
    const ownActions = globalActionLog.current.filter(a => a.userId === user._id && !a.isUndone);
    if (ownActions.length === 0) return;
    const lastAction = ownActions[ownActions.length - 1];
    lastAction.isUndone = true;
    localUndoStack.current.push(lastAction.id);
    renderCanvasFromLog();
    updateUndoRedoState();
    if (socketRef.current) socketRef.current.emit('whiteboard-undo', { roomId: roomIdRef.current, actionId: lastAction.id });
  };

  const handleRedo = () => {
    if (localUndoStack.current.length === 0) return;
    const actionId = localUndoStack.current.pop();
    const action = globalActionLog.current.find(a => a.id === actionId);
    if (action) {
      action.isUndone = false;
      renderCanvasFromLog();
      updateUndoRedoState();
      if (socketRef.current) socketRef.current.emit('whiteboard-redo', { roomId: roomIdRef.current, actionId });
    }
  };

  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);

  useEffect(() => {
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || activeEl.isContentEditable) {
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedoRef.current();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearCanvas = (emit = true) => {
    const actionId = Date.now().toString();
    addActionToLog({ id: actionId, userId: user._id, type: 'clear' });
    renderCanvasFromLog();
    localUndoStack.current = [];
    if (emit && socketRef.current) socketRef.current.emit('whiteboard-clear', { roomId: roomIdRef.current, actionId, userId: user._id });
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    if (tool === 'pointer') return;

    const pos = getCanvasPos(e);

    if (tool === 'delete-element') {
      for (let i = globalActionLog.current.length - 1; i >= 0; i--) {
        const action = globalActionLog.current[i];
        if (action.isUndone) continue;
        
        const isAlreadyDeleted = globalActionLog.current.some(a => 
          !a.isUndone && (a.type === 'delete-element' || a.type === 'delete-image') && a.targetId === action.id
        );
        if (isAlreadyDeleted) continue;

        if (['path', 'shape', 'text'].includes(action.type)) {
          if (hitTest(pos, action)) {
            const actionId = Date.now().toString();
            addActionToLog({ id: actionId, userId: user._id, type: 'delete-element', targetId: action.id });
            renderCanvasFromLog();
            localUndoStack.current = [];
            if (socketRef.current) socketRef.current.emit('whiteboard-delete-element', { roomId: roomIdRef.current, actionId, targetId: action.id, userId: user._id });
            return;
          }
        }
      }
      return;
    }

    if (tool === 'text') {
      if (textCursor) commitText();
      else {
        setTextCursor(pos);
        setTextValue('');
      }
      return;
    }

    if (textCursor) commitText();

    setIsDrawing(true);
    lastPoint.current = pos;
    currentActionId.current = Date.now().toString();

    if (['pen', 'eraser'].includes(tool)) {
      currentPath.current = { id: currentActionId.current, userId: user._id, type: 'path', data: [] };
      addActionToLog(currentPath.current);
    } else if (['rect', 'circle', 'line', 'arrow'].includes(tool)) {
      previewImageData.current = ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    if (!isDrawing || !lastPoint.current || tool === 'text' || tool === 'pointer') return;
    const current = getCanvasPos(e);

    if (['pen', 'eraser'].includes(tool)) {
      const stroke = {
        x0: lastPoint.current.x, y0: lastPoint.current.y,
        x1: current.x,           y1: current.y,
        color:  tool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor,
        width:  tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
        eraser: tool === 'eraser',
      };
      applyStroke(ctxRef.current, stroke);
      currentPath.current.data.push(stroke);
      if (socketRef.current) socketRef.current.emit('draw', { roomId: roomIdRef.current, stroke, actionId: currentActionId.current, userId: user._id });
      lastPoint.current = current;
    } else {
      ctxRef.current.putImageData(previewImageData.current, 0, 0);
      const shape = {
        type: tool,
        x0: lastPoint.current.x, y0: lastPoint.current.y,
        x1: current.x,           y1: current.y,
        color: strokeColor,
        width: strokeWidth
      };
      applyShape(ctxRef.current, shape);
    }
  };

  const onPointerUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (['rect', 'circle', 'line', 'arrow'].includes(tool) && lastPoint.current) {
      const current = getCanvasPos(e);
      const shape = {
        type: tool,
        x0: lastPoint.current.x, y0: lastPoint.current.y,
        x1: current.x,           y1: current.y,
        color: strokeColor,
        width: strokeWidth
      };
      ctxRef.current.putImageData(previewImageData.current, 0, 0);
      applyShape(ctxRef.current, shape);
      addActionToLog({ id: currentActionId.current, userId: user._id, type: 'shape', data: shape });
      if (socketRef.current) socketRef.current.emit('draw-shape', { roomId: roomIdRef.current, shape, actionId: currentActionId.current, userId: user._id });
    }

    lastPoint.current = null;
    previewImageData.current = null;
    currentActionId.current = null;
    currentPath.current = null;
    localUndoStack.current = [];
  };

  const commitText = () => {
    if (textCursor && textValue.trim()) {
      const textObj = { text: textValue, x: textCursor.x, y: textCursor.y, color: strokeColor };
      applyText(ctxRef.current, textObj);
      const actionId = Date.now().toString();
      addActionToLog({ id: actionId, userId: user._id, type: 'text', data: textObj });
      if (socketRef.current) socketRef.current.emit('draw-text', { roomId: roomIdRef.current, textObj, actionId, userId: user._id });
      localUndoStack.current = [];
    }
    setTextCursor(null);
    setTextValue('');
  };

  const addImageToCanvas = (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      const MAX_SIZE = 800;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w *= ratio;
        h *= ratio;
      }
      const newImage = { id: Date.now().toString(), dataUrl, x: 50, y: 50, width: w, height: h };
      setImages(prev => [...prev, newImage]);
      const actionId = Date.now().toString();
      addActionToLog({ id: actionId, userId: user._id, type: 'image-add', data: newImage });
      if (socketRef.current) socketRef.current.emit('image-add', { roomId: roomIdRef.current, image: newImage, actionId, userId: user._id });
      setTool('pointer');
      localUndoStack.current = [];
    };
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => addImageToCanvas(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file.size > 5 * 1024 * 1024) {
            alert('Pasted image exceeds 5MB limit.');
            continue;
          }
          const reader = new FileReader();
          reader.onload = (ev) => addImageToCanvas(ev.target.result);
          reader.readAsDataURL(file);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleImagePointerDown = (e, img) => {
    if (tool === 'delete-element') {
      e.preventDefault();
      e.stopPropagation();
      
      const actionId = Date.now().toString();
      addActionToLog({ id: actionId, userId: user._id, type: 'delete-element', targetId: img.id });
      renderCanvasFromLog();
      localUndoStack.current = [];
      if (socketRef.current) socketRef.current.emit('whiteboard-delete-element', { roomId: roomIdRef.current, actionId, targetId: img.id, userId: user._id });
      return;
    }

    if (tool !== 'pointer') return;
    e.preventDefault();
    e.stopPropagation();
    draggingImage.current = {
      id: img.id,
      startX: e.clientX,
      startY: e.clientY,
      initialImageX: img.x,
      initialImageY: img.y,
    };
  };

  const handleHandlePointerDown = (e, img) => {
    if (tool !== 'pointer') return;
    e.preventDefault();
    e.stopPropagation();
    resizingImage.current = {
      id: img.id,
      startX: e.clientX,
      startY: e.clientY,
      initialW: img.width,
      initialH: img.height,
    };
  };

  const handleDeleteImage = (img) => {
    const actionId = Date.now().toString();
    addActionToLog({ id: actionId, userId: user._id, type: 'delete-image', targetId: img.id, image: img });
    if (socketRef.current) socketRef.current.emit('delete-image', { roomId: roomIdRef.current, targetId: img.id, image: img, actionId, userId: user._id });
    renderCanvasFromLog();
    localUndoStack.current = [];
  };

  useEffect(() => {
    const handleWindowPointerMove = (e) => {
      if (draggingImage.current) {
        const { id, startX, startY, initialImageX, initialImageY } = draggingImage.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setImages(prev => prev.map(img => img.id === id ? { ...img, x: initialImageX + dx, y: initialImageY + dy } : img));
        if (socketRef.current) socketRef.current.emit('image-update', { roomId: roomIdRef.current, update: { id, x: initialImageX + dx, y: initialImageY + dy } });
      } else if (resizingImage.current) {
        const { id, startX, startY, initialW, initialH } = resizingImage.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newW = Math.max(20, initialW + dx);
        const newH = Math.max(20, initialH + dy);
        setImages(prev => prev.map(img => img.id === id ? { ...img, width: newW, height: newH } : img));
        if (socketRef.current) socketRef.current.emit('image-update', { roomId: roomIdRef.current, update: { id, width: newW, height: newH } });
      }
    };
    const handleWindowPointerUp = () => {
      if (draggingImage.current) {
        const { id } = draggingImage.current;
        setImages(prev => {
          const img = prev.find(i => i.id === id);
          if (img) {
            const actionId = Date.now().toString();
            const update = { id, x: img.x, y: img.y };
            addActionToLog({ id: actionId, userId: user._id, type: 'image-update', data: update });
            if (socketRef.current) socketRef.current.emit('image-update', { roomId: roomIdRef.current, update, actionId, userId: user._id });
            localUndoStack.current = [];
          }
          return prev;
        });
        draggingImage.current = null;
      }
      if (resizingImage.current) {
        const { id } = resizingImage.current;
        setImages(prev => {
          const img = prev.find(i => i.id === id);
          if (img) {
            const actionId = Date.now().toString();
            const update = { id, width: img.width, height: img.height };
            addActionToLog({ id: actionId, userId: user._id, type: 'image-update', data: update });
            if (socketRef.current) socketRef.current.emit('image-update', { roomId: roomIdRef.current, update, actionId, userId: user._id });
            localUndoStack.current = [];
          }
          return prev;
        });
        resizingImage.current = null;
      }
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Render helpers
  // ═══════════════════════════════════════════════════════════════════════════
  const StatusBadge = () => {
    const cfg = {
      waiting:      { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Waiting for peer',  cls: 'bg-yellow-100 text-yellow-800' },
      connected:    { icon: <Wifi className="w-3 h-3" />,                 label: 'Connected',         cls: 'bg-green-100 text-green-800' },
      disconnected: { icon: <WifiOff className="w-3 h-3" />,              label: 'Peer disconnected', cls: 'bg-red-100 text-red-800' },
    }[peerStatus];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Early-return states
  // ═══════════════════════════════════════════════════════════════════════════
  if (roomLoading) {
    return (
      <div className="loading-page">
        <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
        <span className="ml-3 text-sm text-brand-muted">Loading room…</span>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] px-6 text-center bg-brand-bg">
        <div className="bg-brand-surface border border-black/[0.08] rounded-[8px] p-8 max-w-md">
          <WifiOff className="w-10 h-10 text-brand-muted mx-auto mb-4" />
          <h2 className="text-lg font-medium text-brand-text mb-2">Cannot join room</h2>
          <p className="text-sm text-brand-muted mb-6">{roomError}</p>
          <Link to="/requests" className="inline-flex items-center text-sm font-medium text-brand-text underline underline-offset-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Requests
          </Link>
        </div>
      </div>
    );
  }

  // Session complete screen
  if (sessionDone) {
    return (
      <SessionComplete
        partnerName={partnerName}
        durationSecs={finalDuration}
        recordingBlob={recordingBlob}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Main room layout
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div ref={containerRef} className={`flex flex-col ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-64px)]'} bg-gray-900 text-white select-none overflow-hidden`}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleLeave} className="text-gray-400 hover:text-white transition" title="Leave room">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <StatusBadge />
          {peerStatus === 'connected' && (
            <span className="text-xs font-mono text-gray-400">{formatTime(elapsed)}</span>
          )}
        </div>

        <span className="text-sm font-medium text-gray-300 hidden sm:block">
          Skill Exchange Session{partnerName ? ` · ${partnerName}` : ''}
        </span>

        <div className="flex items-center gap-2">
          {/* Socket status dot */}
          <span
            title={`Socket: ${socketStatus}`}
            className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-green-400' : socketStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400'}`}
          />

          {/* Record button */}
          <button
            onClick={toggleRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
            className={`p-2 rounded-lg transition flex items-center gap-1 text-xs font-medium ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            <Circle className={`w-3 h-3 ${isRecording ? 'fill-white animate-pulse' : 'fill-current'}`} />
            <span className="hidden sm:inline">{isRecording ? 'Stop REC' : 'Record'}</span>
          </button>

          {/* Recording indicator – always visible when active */}
          {isRecording && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
              ● REC
            </span>
          )}

          {/* Mic */}
          <button
            onClick={toggleMic}
            title={micOn ? 'Mute mic' : 'Unmute mic'}
            className={`p-2 rounded-lg transition ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCam}
            title={camOn ? 'Turn off camera' : 'Turn on camera'}
            className={`p-2 rounded-lg transition ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => setChatOpen(o => !o)}
            title={chatOpen ? 'Close chat' : 'Open chat'}
            className={`p-2 rounded-lg transition ${chatOpen ? 'bg-gray-500 hover:bg-gray-400' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Leave */}
          <button
            onClick={handleLeave}
            title="Leave room"
            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Media error banner ────────────────────────────────────────────── */}
      {mediaError && (
        <div className="bg-amber-600 text-white text-sm px-4 py-2 flex items-center gap-2 shrink-0">
          <VideoOff className="w-4 h-4 shrink-0" />
          <span>{mediaError} Whiteboard is still available.</span>
        </div>
      )}

      {/* ── Recording banner (unmistakable, persists while recording) ─────── */}
      {isRecording && (
        <div className="shrink-0 bg-red-700 text-white text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
          <Circle className="w-3 h-3 fill-white animate-pulse" />
          Recording in progress — your session is being captured locally
        </div>
      )}

      {/* ── Body: video panel + whiteboard + optional chat ─────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: video tiles */}
        <div className="flex flex-col gap-2 p-2 w-64 shrink-0 bg-gray-900">
          {/* Local */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              className={`w-full h-full object-cover ${!camOn ? 'invisible' : ''}`}
            />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-500" />
              </div>
            )}
            <span className="absolute bottom-1 left-2 text-xs font-medium bg-black/60 px-1.5 py-0.5 rounded">You</span>
          </div>

          {/* Remote */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video flex items-center justify-center">
            {peerStatus === 'waiting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                <span className="text-xs text-gray-500">Waiting for peer…</span>
              </div>
            )}
            {peerStatus === 'disconnected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <WifiOff className="w-6 h-6 text-red-400" />
                <span className="text-xs text-red-400">Peer disconnected</span>
              </div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay playsInline
              className={`w-full h-full object-cover ${peerStatus !== 'connected' ? 'invisible' : ''}`}
            />
            <span className="absolute bottom-1 left-2 text-xs font-medium bg-black/60 px-1.5 py-0.5 rounded">
              {partnerName || 'Peer'}
            </span>
          </div>

          {/* Download recording if stopped inside room */}
          {recordingBlob && !isRecording && (
            <button
              onClick={() => {
                const url  = URL.createObjectURL(recordingBlob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `session-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition"
            >
              <Download className="w-3 h-3" /> Download Recording
            </button>
          )}
        </div>

        {/* Centre: whiteboard */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0 flex-wrap overflow-visible">
            <button onClick={() => setTool('pointer')} className={`p-2 rounded-lg transition ${tool === 'pointer' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Select/Move Images">
              <MousePointer2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-600 mx-1" />
            <button onClick={() => setTool('pen')} className={`p-2 rounded-lg transition ${tool === 'pen' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Pen">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg transition ${tool === 'eraser' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Eraser">
              <Eraser className="w-4 h-4" />
            </button>
            <button onClick={() => setTool('delete-element')} className={`p-2 rounded-lg transition ${tool === 'delete-element' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Delete Element">
              <Delete className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-600 mx-1" />
            <button onClick={() => setTool('rect')} className={`p-2 rounded-lg transition ${tool === 'rect' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Rectangle">
              <Square className="w-4 h-4" />
            </button>
            <button onClick={() => setTool('circle')} className={`p-2 rounded-lg transition ${tool === 'circle' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Circle">
              <CircleIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setTool('line')} className={`p-2 rounded-lg transition ${tool === 'line' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Line">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={() => setTool('arrow')} className={`p-2 rounded-lg transition ${tool === 'arrow' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Arrow">
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-600 mx-1" />
            <button onClick={() => setTool('text')} className={`p-2 rounded-lg transition ${tool === 'text' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Text">
              <Type className="w-4 h-4" />
            </button>
            <div className="relative">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg transition bg-gray-700 hover:bg-gray-600" title="Add Image">
                <ImageIcon className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setStrokeColor(c)}
                style={{
                  backgroundColor: c,
                  border: strokeColor === c ? '2px solid white' : '2px solid transparent',
                }}
                className="w-6 h-6 rounded-full transition shrink-0"
                title={c}
              />
            ))}

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <input
              type="range" min="1" max="20"
              value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
              className="w-20 accent-brand-text"
              title="Stroke width"
            />
            <span className="text-xs text-gray-400 w-4">{strokeWidth}</span>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            {/* Undo / Redo */}
            <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600" title="Undo">
              <Undo className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600" title="Redo">
              <Redo className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            {/* Recently deleted */}
            <div className="relative">
              <button onClick={() => setShowDeletedPanel(p => !p)} className={`p-2 rounded-lg transition ${showDeletedPanel ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'} flex items-center gap-1`} title="Recently Deleted">
                <History className="w-4 h-4" />
                {deletedImages.length > 0 && <span className="text-[10px] font-bold bg-red-600 px-1.5 rounded-full">{deletedImages.length}</span>}
              </button>
              {showDeletedPanel && deletedImages.length > 0 && (
                <div className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 z-50 w-48 max-h-64 overflow-y-auto">
                  <div className="text-xs font-medium text-gray-400 mb-2">Recently Deleted</div>
                  <div className="flex flex-col gap-2">
                    {deletedImages.map(img => (
                      <div key={img.id} className="flex items-center justify-between gap-2 p-1 hover:bg-gray-700 rounded transition group">
                        <img src={img.dataUrl} className="w-8 h-8 object-cover rounded bg-white" alt="deleted" />
                        <div className="flex gap-1">
                          <button onClick={() => {
                            const deleteAction = globalActionLog.current.find(a => (a.type === 'delete-image' || a.type === 'delete-element') && a.targetId === img.id && !a.isUndone);
                            if (deleteAction) {
                              deleteAction.isUndone = true;
                              renderCanvasFromLog();
                              updateUndoRedoState();
                              if (socketRef.current) socketRef.current.emit('whiteboard-undo', { roomId: roomIdRef.current, actionId: deleteAction.id });
                            }
                          }} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">Restore</button>
                          
                          <button onClick={() => {
                            if (!window.confirm("Permanently delete this item?")) return;
                            const actionId = Date.now().toString();
                            addActionToLog({ id: actionId, userId: user._id, type: 'permanent-delete', targetId: img.id });
                            renderCanvasFromLog();
                            if (socketRef.current) socketRef.current.emit('whiteboard-permanent-delete', { roomId: roomIdRef.current, actionId, targetId: img.id, userId: user._id });
                          }} className="text-xs bg-red-600 hover:bg-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition" title="Delete permanently">
                            <XSquare className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <button onClick={toggleFullscreen} className="p-2 rounded-lg transition bg-gray-700 hover:bg-gray-600" title="Toggle Fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button
              onClick={() => clearCanvas(true)}
              className="p-2 bg-gray-700 hover:bg-red-700 rounded-lg transition"
              title="Clear whiteboard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas & Overlays */}
          <div className="relative flex-1 bg-white overflow-hidden">
            {images.map(img => (
              <div
                key={img.id}
                className="group"
                style={{
                  position: 'absolute',
                  left: img.x,
                  top: img.y,
                  width: img.width,
                  height: img.height,
                  cursor: tool === 'pointer' ? 'move' : 'default',
                  zIndex: 10
                }}
                onPointerDown={(e) => handleImagePointerDown(e, img)}
              >
                <img src={img.dataUrl} alt="Whiteboard imported" className="w-full h-full object-fill pointer-events-none" />
                
                {tool === 'pointer' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(img); }}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow z-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {tool === 'pointer' && (
                  <div
                    onPointerDown={(e) => handleHandlePointerDown(e, img)}
                    className="absolute right-0 bottom-0 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 z-50"
                  />
                )}
              </div>
            ))}
            
            <canvas
              ref={canvasRef}
              style={{ pointerEvents: tool === 'pointer' ? 'none' : 'auto', zIndex: 20 }}
              className={`absolute inset-0 w-full h-full ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'} touch-none`}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
            />

            {tool === 'text' && textCursor && (
              <input
                autoFocus
                type="text"
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onBlur={commitText}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitText();
                  }
                }}
                style={{
                  position: 'absolute',
                  left: textCursor.x,
                  top: textCursor.y,
                  color: strokeColor,
                  zIndex: 30
                }}
                className="bg-transparent border-none outline-none p-0 m-0 text-[16px] font-sans leading-none"
                placeholder="Type here..."
              />
            )}
          </div>
        </div>

        {/* Right: chat panel (toggled) */}
        {chatOpen && (
          <div className="w-72 shrink-0">
            <ChatPanel
              exchangeRequestId={exchangeRequestId}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
