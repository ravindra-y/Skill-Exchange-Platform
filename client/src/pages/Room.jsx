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
  Loader2, Circle, Download, LayoutDashboard,
} from 'lucide-react';

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
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wifi className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Session Complete</h1>
        <p className="text-gray-500 mb-8">Great session with <span className="font-semibold text-gray-800">{partnerName || 'your partner'}</span>!</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{formatTime(durationSecs)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recording</p>
            <p className="text-2xl font-bold text-gray-900">{recordingBlob ? '✓ Ready' : '—'}</p>
          </div>
        </div>

        {/* Download recording */}
        {recordingBlob && (
          <button
            onClick={handleDownload}
            className="w-full mb-3 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition"
          >
            <Download className="w-5 h-5" />
            Download Recording (.webm)
          </button>
        )}

        {/* Back to dashboard */}
        <Link
          to="/dashboard"
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
        >
          <LayoutDashboard className="w-5 h-5" />
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
  const [micOn, setMicOn]               = useState(true);
  const [camOn, setCamOn]               = useState(true);
  const [peerStatus, setPeerStatus]     = useState('waiting');
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [mediaError, setMediaError]     = useState(null);

  // ── Recording state ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording]   = useState(false);

  // ── Session timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const timerRef              = useRef(null);

  // ── Whiteboard state ───────────────────────────────────────────────────────
  const [tool, setTool]               = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing]     = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localVideoRef    = useRef(null);
  const remoteVideoRef   = useRef(null);
  const pcRef            = useRef(null);
  const localStreamRef   = useRef(null);
  const remoteStreamRef  = useRef(null);
  const socketRef        = useRef(null);
  const canvasRef        = useRef(null);
  const ctxRef           = useRef(null);
  const lastPoint        = useRef(null);
  const isMakingOffer    = useRef(false);
  const roomIdRef        = useRef(null);

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
      // 2a. Get local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        if (cancelled) return;
        const msg = err.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied. Please allow access and reload.'
          : `Could not access camera/mic: ${err.message}`;
        setMediaError(msg);
      }

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
      socket.on('draw',            ({ stroke }) => remoteDraw(stroke));
      socket.on('whiteboard-clear', () => clearCanvas(false));
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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

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
  const leaveRoom = useCallback(() => {
    stopTimer();
    // Stop recording if active; onstop will fire and set the blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
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

  const remoteDraw = (stroke) => { if (ctxRef.current) applyStroke(ctxRef.current, stroke); };

  const clearCanvas = (emit = true) => {
    if (!ctxRef.current || !canvasRef.current) return;
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (emit && socketRef.current) socketRef.current.emit('whiteboard-clear', { roomId: roomIdRef.current });
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
      x0: lastPoint.current.x, y0: lastPoint.current.y,
      x1: current.x,           y1: current.y,
      color:  tool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor,
      width:  tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      eraser: tool === 'eraser',
    };
    applyStroke(ctxRef.current, stroke);
    if (socketRef.current) socketRef.current.emit('draw', { roomId: roomIdRef.current, stroke });
    lastPoint.current = current;
  };

  const onPointerUp = () => { setIsDrawing(false); lastPoint.current = null; };

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
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-white select-none overflow-hidden">

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

      {/* ── Body: video panel + whiteboard ───────────────────────────────── */}
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
              className="flex items-center justify-center gap-2 py-2 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-xs font-medium transition"
            >
              <Download className="w-3 h-3" /> Download Recording
            </button>
          )}
        </div>

        {/* Right: whiteboard */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0 flex-wrap">
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

            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setStrokeColor(c); setTool('pen'); }}
                style={{
                  backgroundColor: c,
                  border: strokeColor === c && tool === 'pen' ? '2px solid white' : '2px solid transparent',
                }}
                className="w-6 h-6 rounded-full transition shrink-0"
                title={c}
              />
            ))}

            <div className="w-px h-5 bg-gray-600" />

            <input
              type="range" min="1" max="20"
              value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
              className="w-24 accent-indigo-500"
              title="Stroke width"
            />
            <span className="text-xs text-gray-400 w-4">{strokeWidth}</span>

            <div className="w-px h-5 bg-gray-600" />

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
