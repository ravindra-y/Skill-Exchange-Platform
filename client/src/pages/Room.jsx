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
  Loader2,
} from 'lucide-react';

const SOCKET_URL = 'http://localhost:5000';

// ─── ICE server config (STUN only for local dev) ──────────────────────────
const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// ─── Whiteboard colours ────────────────────────────────────────────────────
const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ffffff'];

export default function Room() {
  const { id: exchangeRequestId } = useParams(); // Phase 1 links pass exchange-request id
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // ── Room state ────────────────────────────────────────────────────────────
  const [roomId, setRoomId]             = useState(null);
  const [roomLoading, setRoomLoading]   = useState(true);
  const [roomError, setRoomError]       = useState(null);

  // ── Media/WebRTC state ────────────────────────────────────────────────────
  const [micOn, setMicOn]               = useState(true);
  const [camOn, setCamOn]               = useState(true);
  const [peerStatus, setPeerStatus]     = useState('waiting'); // waiting | connected | disconnected
  const [socketStatus, setSocketStatus] = useState('connecting'); // connecting | connected | error
  const [mediaError, setMediaError]     = useState(null);

  // ── Session timer ─────────────────────────────────────────────────────────
  const [elapsed, setElapsed]           = useState(0);
  const timerRef                        = useRef(null);

  // ── Whiteboard state ──────────────────────────────────────────────────────
  const [tool, setTool]                 = useState('pen'); // pen | eraser
  const [strokeColor, setStrokeColor]   = useState('#1e293b');
  const [strokeWidth, setStrokeWidth]   = useState(3);
  const [isDrawing, setIsDrawing]       = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef          = useRef(null);   // RTCPeerConnection
  const localStreamRef = useRef(null);
  const socketRef      = useRef(null);
  const canvasRef      = useRef(null);
  const ctxRef         = useRef(null);
  const lastPoint      = useRef(null);
  const isMakingOffer  = useRef(false);
  const roomIdRef      = useRef(null);   // stable ref for callbacks

  // ═══════════════════════════════════════════════════════════════════════════
  // 1.  Resolve the actual Room document from the exchange-request id
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const resolveRoom = async () => {
      try {
        const { data } = await api.get(`/rooms/by-exchange/${exchangeRequestId}`);
        setRoomId(data._id);
        roomIdRef.current = data._id;
      } catch (err) {
        setRoomError(
          err.response?.data?.message || 'Room not found or you are not a participant.'
        );
      } finally {
        setRoomLoading(false);
      }
    };
    resolveRoom();
  }, [exchangeRequestId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2.  Initialise media → WebRTC → Socket.io once roomId is known
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    const start = async () => {
      // ── 2a. Get local media ────────────────────────────────────────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied. Please allow access in your browser and reload.'
          : `Could not access camera/mic: ${err.message}`;
        setMediaError(msg);
        // Continue without media — socket still connects (whiteboard still works)
      }

      // ── 2b. Build Socket.io connection ────────────────────────────────
      const socket = io(SOCKET_URL, {
        withCredentials: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setSocketStatus('connected');
        // (Re-)join the room after every connect / reconnect
        socket.emit('join-room', { roomId: roomIdRef.current });
      });

      socket.on('connect_error', (err) => {
        console.error('[socket] connect_error', err.message);
        setSocketStatus('error');
      });

      socket.on('disconnect', () => {
        setSocketStatus('connecting');
      });

      // ── 2c. Room events ───────────────────────────────────────────────
      socket.on('room-error', ({ message }) => {
        console.error('[room-error]', message);
        setRoomError(message);
      });

      socket.on('room-joined', ({ peerAlreadyPresent }) => {
        if (peerAlreadyPresent) {
          // I joined second — create offer
          createOffer(socket);
        }
      });

      socket.on('peer-joined', () => {
        // Peer joined after me — they will send an offer, I just wait
        setPeerStatus('waiting');
      });

      socket.on('peer-left', () => {
        setPeerStatus('disconnected');
        cleanupPeerConnection();
        stopTimer();
      });

      // ── 2d. WebRTC signaling ──────────────────────────────────────────
      socket.on('signal', async ({ data }) => {
        if (data.type === 'offer') {
          await handleOffer(data, socket);
        } else if (data.type === 'answer') {
          await handleAnswer(data);
        } else if (data.candidate) {
          await addIceCandidate(data);
        }
      });

      // ── 2e. Whiteboard events ─────────────────────────────────────────
      socket.on('draw', ({ stroke }) => {
        remoteDraw(stroke);
      });

      socket.on('whiteboard-clear', () => {
        clearCanvas(false);
      });
    };

    start();

    return () => {
      cancelled = true;
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3.  WebRTC helpers
  // ═══════════════════════════════════════════════════════════════════════════
  const buildPeerConnection = (socket) => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Remote track → remote video element
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setPeerStatus('connected');
      startTimer();
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal', {
          roomId: roomIdRef.current,
          data: event.candidate,
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeerStatus('disconnected');
        stopTimer();
      }
      if (pc.connectionState === 'connected') {
        setPeerStatus('connected');
      }
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
      console.error('[createOffer error]', err);
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
      console.error('[handleOffer error]', err);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      if (pcRef.current && pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error('[handleAnswer error]', err);
    }
  };

  const addIceCandidate = async (candidate) => {
    try {
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('[addIceCandidate error]', err);
    }
  };

  const cleanupPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.ontrack       = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4.  Timer helpers
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
  // 5.  Media controls
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 6.  Leave / cleanup
  // ═══════════════════════════════════════════════════════════════════════════
  const leaveRoom = useCallback(() => {
    stopTimer();
    cleanupPeerConnection();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId: roomIdRef.current });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const handleLeave = () => {
    leaveRoom();
    navigate('/requests');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 7.  Whiteboard — canvas setup
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    const handleResize = () => {
      // Preserve drawing on resize by copying to temp image
      const img = new Image();
      img.src = canvas.toDataURL();
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      img.onload = () => ctx.drawImage(img, 0, 0);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [roomId]); // re-init when room loads

  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
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

  const remoteDraw = (stroke) => {
    if (!ctxRef.current) return;
    applyStroke(ctxRef.current, stroke);
  };

  const clearCanvas = (emit = true) => {
    if (!ctxRef.current || !canvasRef.current) return;
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (emit && socketRef.current) {
      socketRef.current.emit('whiteboard-clear', { roomId: roomIdRef.current });
    }
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPoint.current = getCanvasPos(e);
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    if (!isDrawing || !lastPoint.current) return;
    const current = getCanvasPos(e);
    const stroke = {
      x0: lastPoint.current.x,
      y0: lastPoint.current.y,
      x1: current.x,
      y1: current.y,
      color: tool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor,
      width: tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      eraser: tool === 'eraser',
    };
    applyStroke(ctxRef.current, stroke);
    if (socketRef.current) {
      socketRef.current.emit('draw', { roomId: roomIdRef.current, stroke });
    }
    lastPoint.current = current;
  };

  const onPointerUp = () => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 8.  Render helpers
  // ═══════════════════════════════════════════════════════════════════════════
  const StatusBadge = () => {
    const cfg = {
      waiting:      { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Waiting for peer', cls: 'bg-yellow-100 text-yellow-800' },
      connected:    { icon: <Wifi className="w-3 h-3" />,                 label: 'Connected',        cls: 'bg-green-100 text-green-800' },
      disconnected: { icon: <WifiOff className="w-3 h-3" />,              label: 'Peer disconnected', cls: 'bg-red-100 text-red-800' },
    }[peerStatus];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 9.  Early-return states
  // ═══════════════════════════════════════════════════════════════════════════
  if (roomLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Loading room…</span>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 mb-2">Cannot join room</h2>
          <p className="text-red-600 mb-6">{roomError}</p>
          <Link to="/requests" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requests
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10.  Main layout
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-white select-none overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/requests" className="text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <StatusBadge />
          {peerStatus === 'connected' && (
            <span className="text-xs font-mono text-gray-400">{formatTime(elapsed)}</span>
          )}
        </div>

        <span className="text-sm font-medium text-gray-300 hidden sm:block">Skill Exchange Session</span>

        <div className="flex items-center gap-2">
          {/* Socket status dot */}
          <span title={`Socket: ${socketStatus}`} className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-green-400' : socketStatus === 'error' ? 'bg-red-400' : 'bg-yellow-400'}`} />

          {/* Mic */}
          <button
            onClick={toggleMic}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
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

      {/* ── Media permission error banner ─────────────────────────────────── */}
      {mediaError && (
        <div className="bg-amber-600 text-white text-sm px-4 py-2 flex items-center gap-2 shrink-0">
          <VideoOff className="w-4 h-4 shrink-0" />
          <span>{mediaError} You can still use the whiteboard.</span>
        </div>
      )}

      {/* ── Body: video + whiteboard ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: video tiles ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 p-2 w-64 shrink-0 bg-gray-900">
          {/* Local */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!camOn ? 'invisible' : ''}`}
            />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-500" />
              </div>
            )}
            <span className="absolute bottom-1 left-2 text-xs font-medium bg-black/60 px-1.5 py-0.5 rounded">
              You
            </span>
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
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${peerStatus !== 'connected' ? 'invisible' : ''}`}
            />
            <span className="absolute bottom-1 left-2 text-xs font-medium bg-black/60 px-1.5 py-0.5 rounded">
              Peer
            </span>
          </div>
        </div>

        {/* ── Right: whiteboard ─────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0 flex-wrap">
            {/* Pen / Eraser */}
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded-lg transition ${tool === 'pen' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Pen"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg transition ${tool === 'eraser' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-600" />

            {/* Colours */}
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setStrokeColor(c); setTool('pen'); }}
                style={{ backgroundColor: c, border: strokeColor === c && tool === 'pen' ? '2px solid white' : '2px solid transparent' }}
                className="w-6 h-6 rounded-full transition shrink-0"
                title={c}
              />
            ))}

            <div className="w-px h-5 bg-gray-600" />

            {/* Stroke width */}
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
              className="w-24 accent-indigo-500"
              title="Stroke width"
            />
            <span className="text-xs text-gray-400 w-4">{strokeWidth}</span>

            <div className="w-px h-5 bg-gray-600" />

            {/* Clear */}
            <button
              onClick={() => clearCanvas(true)}
              className="p-2 bg-gray-700 hover:bg-red-700 rounded-lg transition"
              title="Clear whiteboard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="flex-1 bg-white cursor-crosshair touch-none"
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
        </div>
      </div>
    </div>
  );
}
