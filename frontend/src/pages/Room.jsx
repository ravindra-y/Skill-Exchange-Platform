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

const SOCKET_URL = 'https://skill-exchange-platform-nypl.onrender.com'

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

  // ── Workspace tabs ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('whiteboard'); // 'whiteboard', 'code', 'notes'
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    const tracks = [];

    // 1. Always capture the whiteboard canvas as a video track (30 fps).
    //    This ensures the .webm always has real video frames so any player
    //    can open it — even when camera is off.
    if (canvasRef.current) {
      try {
        const canvasStream = canvasRef.current.captureStream(30);
        canvasStream.getVideoTracks().forEach(t => tracks.push(t));
      } catch (_) {
        // captureStream not supported — fall through
      }
    }

    // 2. Add live mic / camera tracks if active.
    if (localStreamRef.current)  localStreamRef.current.getTracks().forEach(t  => tracks.push(t));
    if (remoteStreamRef.current) remoteStreamRef.current.getTracks().forEach(t => tracks.push(t));

    // 3. If still no audio track, create a silent one so the audio channel
    //    in the .webm is valid (avoids codec warnings in some players).
    const hasAudio = tracks.some(t => t.kind === 'audio');
    if (!hasAudio) {
      try {
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        dest.stream.getAudioTracks().forEach(t => tracks.push(t));
      } catch (_) { /* ignore */ }
    }

    if (tracks.length === 0) {
      alert('Cannot start recording: no recordable tracks available.');
      return;
    }

    const combinedStream = new MediaStream(tracks);

    // Pick best supported MIME type — prefer vp9 for quality
    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(t => MediaRecorder.isTypeSupported(t)) || '';

    let mr;
    try {
      mr = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});
    } catch (e) {
      alert(`Cannot start recording: ${e.message}`);
      return;
    }

    const chunks = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mr.onstop = () => {
      const finalMime = mr.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: finalMime });
      setRecordingBlob(blob);
      setIsRecording(false);
    };

    mr.start(500); // smaller chunks = smoother file
    mediaRecorderRef.current = mr;
    recordedChunks.current = chunks;
    setIsRecording(true);
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') {
      mediaRecorderRef.current = null;
      return Promise.resolve(null);
    }

    // Return a Promise that resolves with the finished Blob once onstop fires
    return new Promise((resolve) => {
      const originalOnStop = mr.onstop;
      mr.onstop = () => {
        if (originalOnStop) originalOnStop();
        resolve(recordingBlob); // blob will be set by originalOnStop
      };
      mr.stop();
      mediaRecorderRef.current = null;
    });
  };

  const handleLeave = async () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const duration = elapsed;
    stopTimer();

    let finalBlob = recordingBlob; // already-stopped blob (if any)

    if (isRecording) {
      // Wait for onstop to fire so we have the complete blob
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        finalBlob = await new Promise((resolve) => {
          const chunks = recordedChunks.current;
          mr.onstop = () => {
            const mime = mr.mimeType || 'video/webm';
            const blob = new Blob(chunks, { type: mime });
            setRecordingBlob(blob);
            setIsRecording(false);
            resolve(blob);
          };
          mr.stop();
          mediaRecorderRef.current = null;
        });
      }
    }

    leaveRoom();
    setFinalDuration(duration);
    if (finalBlob) setRecordingBlob(finalBlob);
    setSessionDone(true);
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

  // handleLeave is defined above (async, awaits recording blob before transitioning)

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
    <div ref={containerRef} className="flex flex-col h-screen bg-brand-bg text-brand-text select-none overflow-hidden relative">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-brand-surface border-b border-black/[0.08] shrink-0 z-50 shadow-sm relative">
        {/* Left */}
        <div className="flex items-center gap-4 w-1/3">
          <button onClick={handleLeave} className="text-brand-muted hover:text-brand-text transition-colors flex items-center gap-1.5" title="Exit Session">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <div className="h-4 w-px bg-black/[0.08]" />
          <StatusBadge />
          {peerStatus === 'connected' && (
            <span className="text-xs font-mono font-medium text-brand-muted bg-brand-surface-2 px-2 py-0.5 rounded-full">{formatTime(elapsed)}</span>
          )}
        </div>

        {/* Center: Mode Switcher */}
        <div className="flex items-center justify-center w-1/3">
          <div className="flex p-1 bg-brand-surface-2 rounded-full border border-black/[0.04]">
            {['whiteboard', 'code', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-brand-surface text-brand-text shadow-sm'
                    : 'text-brand-muted hover:text-brand-text hover:bg-black/[0.02]'
                }`}
              >
                {tab === 'whiteboard' ? '🎨 Whiteboard' : tab === 'code' ? '💻 Code' : '📝 Notes'}
              </button>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center justify-end w-1/3 gap-3">
          {isRecording && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-error/10 border border-status-error/20 text-status-error text-[11px] font-bold tracking-wide uppercase animate-pulse">
              <Circle className="w-2 h-2 fill-current" /> REC
            </span>
          )}
          <button
            onClick={() => setChatOpen(o => !o)}
            className={`p-2 rounded-full transition-colors ${chatOpen ? 'bg-brand-text text-brand-bg' : 'text-brand-muted hover:bg-black/[0.05]'}`}
            title="Toggle Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Media error banner ────────────────────────────────────────────── */}
      {mediaError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-white text-[13px] font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <VideoOff className="w-4 h-4 shrink-0" />
          <span>{mediaError} Whiteboard is still available.</span>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left: Video sidebar (Collapsible) */}
        <div className={`relative flex flex-col gap-3 p-4 shrink-0 bg-brand-surface border-r border-black/[0.08] transition-all duration-300 z-10 ${sidebarOpen ? 'w-[280px]' : 'w-0 p-0 overflow-hidden border-none'}`}>
          {/* Local */}
          <div className="relative rounded-[16px] overflow-hidden bg-brand-surface-2 aspect-video flex items-center justify-center shadow-sm border border-black/[0.04]">
            <video
              ref={localVideoRef}
              autoPlay muted playsInline
              className={`w-full h-full object-cover ${!camOn ? 'invisible' : ''}`}
            />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-brand-faint" />
              </div>
            )}
            <span className="absolute bottom-2 left-2 text-[10px] font-medium text-brand-bg bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">You</span>
          </div>

          {/* Remote */}
          <div className="relative rounded-[16px] overflow-hidden bg-brand-surface-2 aspect-video flex items-center justify-center shadow-sm border border-black/[0.04]">
            {peerStatus === 'waiting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-muted" />
                <span className="text-xs text-brand-muted font-medium">Waiting for peer…</span>
              </div>
            )}
            {peerStatus === 'disconnected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <WifiOff className="w-6 h-6 text-status-error opacity-80" />
                <span className="text-xs text-status-error font-medium">Peer disconnected</span>
              </div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay playsInline
              className={`w-full h-full object-cover ${peerStatus !== 'connected' ? 'invisible' : ''}`}
            />
            <span className="absolute bottom-2 left-2 text-[10px] font-medium text-brand-bg bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
              {partnerName || 'Peer'}
            </span>
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 transition-all duration-300" style={{ transform: `translate(${sidebarOpen ? '280px' : '0px'}, -50%)` }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-6 h-12 bg-brand-surface border border-black/[0.08] rounded-r-lg shadow-sm flex items-center justify-center hover:bg-black/[0.02] text-brand-muted"
          >
            <span className="text-[10px] font-bold">{sidebarOpen ? '«' : '»'}</span>
          </button>
        </div>

        {/* Center: Canvas / Editor */}
        <div className="flex flex-col flex-1 overflow-hidden relative bg-brand-surface-2">

          {activeTab === 'whiteboard' && (
            <>
              {/* Vertical Floating Whiteboard Toolbar */}
              <div className="absolute left-6 top-6 z-30 flex flex-col gap-1.5 p-2 bg-brand-surface border border-black/[0.08] rounded-2xl shadow-sm">
                <button onClick={() => setTool('pointer')} className={`p-2.5 rounded-xl transition-all ${tool === 'pointer' ? 'bg-brand-surface-2 text-brand-text' : 'text-brand-muted hover:bg-black/[0.04]'}`} title="Select/Move">
                  <MousePointer2 className="w-4 h-4" />
                </button>
                <button onClick={() => setTool('pen')} className={`p-2.5 rounded-xl transition-all ${tool === 'pen' ? 'bg-brand-surface-2 text-brand-text' : 'text-brand-muted hover:bg-black/[0.04]'}`} title="Pen">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setTool('rect')} className={`p-2.5 rounded-xl transition-all ${tool === 'rect' ? 'bg-brand-surface-2 text-brand-text' : 'text-brand-muted hover:bg-black/[0.04]'}`} title="Rectangle">
                  <Square className="w-4 h-4" />
                </button>
                <button onClick={() => setTool('circle')} className={`p-2.5 rounded-xl transition-all ${tool === 'circle' ? 'bg-brand-surface-2 text-brand-text' : 'text-brand-muted hover:bg-black/[0.04]'}`} title="Circle">
                  <CircleIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setTool('text')} className={`p-2.5 rounded-xl transition-all ${tool === 'text' ? 'bg-brand-surface-2 text-brand-text' : 'text-brand-muted hover:bg-black/[0.04]'}`} title="Text">
                  <Type className="w-4 h-4" />
                </button>
                <button onClick={() => setTool('eraser')} className={`p-2.5 rounded-xl transition-all ${tool === 'eraser' ? 'bg-brand-surface-2 text-brand-text' : 'text-brand-muted hover:bg-black/[0.04]'}`} title="Eraser">
                  <Eraser className="w-4 h-4" />
                </button>

                <div className="w-full h-px bg-black/[0.08] my-1" />

                {/* Color Picker (Compact) */}
                <div className="relative group flex justify-center p-2">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-brand-surface shadow-sm cursor-pointer"
                    style={{ backgroundColor: strokeColor }}
                  />
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex bg-brand-surface border border-black/[0.08] rounded-xl p-2 gap-2 shadow-lg">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setStrokeColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${strokeColor === c ? 'ring-2 ring-brand-text ring-offset-1' : ''}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-black/[0.08] my-1" />

                <button onClick={handleUndo} disabled={!canUndo} className="p-2.5 rounded-xl transition-all disabled:opacity-30 hover:bg-black/[0.04] text-brand-muted" title="Undo">
                  <Undo className="w-4 h-4" />
                </button>
                <button onClick={handleRedo} disabled={!canRedo} className="p-2.5 rounded-xl transition-all disabled:opacity-30 hover:bg-black/[0.04] text-brand-muted" title="Redo">
                  <Redo className="w-4 h-4" />
                </button>
                <button onClick={() => clearCanvas(true)} className="p-2.5 rounded-xl transition-all hover:bg-status-error/10 hover:text-status-error text-brand-muted mt-2" title="Clear Canvas">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Canvas Overlays & Element */}
              <div className="absolute inset-0 bg-brand-surface z-0 overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, rgba(0,0,0,0.05) 1.5px, transparent 0)', backgroundSize: '24px 24px' }}>
                {images.map(img => (
                  <div
                    key={img.id}
                    className="group"
                    style={{ position: 'absolute', left: img.x, top: img.y, width: img.width, height: img.height, cursor: tool === 'pointer' ? 'move' : 'default', zIndex: 10 }}
                    onPointerDown={(e) => handleImagePointerDown(e, img)}
                  >
                    <img src={img.dataUrl} alt="Imported" className="w-full h-full object-fill pointer-events-none rounded shadow-sm" />
                    {tool === 'pointer' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(img); }} className="absolute -top-3 -right-3 bg-status-error hover:brightness-110 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition shadow-sm z-50">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {tool === 'pointer' && (
                      <div onPointerDown={(e) => handleHandlePointerDown(e, img)} className="absolute right-0 bottom-0 w-4 h-4 bg-brand-blue border-2 border-white rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 z-50 shadow-sm" />
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
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } }}
                    style={{ position: 'absolute', left: textCursor.x, top: textCursor.y, color: strokeColor, zIndex: 30 }}
                    className="bg-transparent border-none outline-none p-0 m-0 text-[16px] font-sans leading-none"
                    placeholder="Type..."
                  />
                )}
              </div>
            </>
          )}

          {activeTab === 'code' && (
            <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col z-0">
              <div className="flex bg-[#2d2d2d] px-4 py-2 border-b border-[#3e3e3e]">
                <div className="px-3 py-1 bg-[#1e1e1e] text-gray-300 text-xs font-medium rounded-t-md">index.js</div>
              </div>
              <div className="flex-1 p-6 text-gray-400 font-mono text-sm leading-relaxed overflow-auto">
                <span className="text-gray-500">{"// Collaborative Code Editor Placeholder"}</span><br/><br/>
                <span className="text-pink-500">function</span> <span className="text-blue-400">helloWorld</span>() {"{"}<br/>
                &nbsp;&nbsp;<span className="text-pink-500">return</span> <span className="text-yellow-300">"Welcome to the session!"</span>;<br/>
                {"}"}<br/><br/>
                <span className="text-gray-500">{"/* Code editor implementation goes here... */"}</span>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="absolute inset-0 bg-brand-surface z-0 p-8 overflow-auto">
              <div className="max-w-2xl mx-auto h-full flex flex-col">
                <h3 className="text-xl font-medium mb-4 text-brand-text">Session Notes & Agenda</h3>
                <textarea
                  className="flex-1 w-full p-4 bg-brand-surface-2 rounded-xl border border-black/[0.08] focus:outline-none focus:border-brand-text focus:ring-1 focus:ring-brand-text resize-none text-[15px] leading-relaxed"
                  placeholder="Draft your session agenda or notes here... (Placeholder for shared notes)"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat Panel */}
        {chatOpen && (
          <div className="w-[320px] shrink-0 border-l border-black/[0.08] bg-brand-surface z-20">
            <ChatPanel exchangeRequestId={exchangeRequestId} onClose={() => setChatOpen(false)} />
          </div>
        )}
      </div>

      {/* ── Floating Call Control Dock ──────────────────────────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#202124] rounded-full shadow-2xl border border-white/10 backdrop-blur-md">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition-all ${micOn ? 'bg-[#3c4043] hover:bg-[#4a4d51] text-white' : 'bg-[#ea4335] hover:bg-[#d93025] text-white'}`}
          title={micOn ? 'Turn off microphone' : 'Turn on microphone'}
        >
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleCam}
          className={`p-3 rounded-full transition-all ${camOn ? 'bg-[#3c4043] hover:bg-[#4a4d51] text-white' : 'bg-[#ea4335] hover:bg-[#d93025] text-white'}`}
          title={camOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Record / Stop + Download */}
        <button
          onClick={toggleRecording}
          className={`p-3 rounded-full transition-all flex items-center gap-2 ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#3c4043] hover:bg-[#4a4d51] text-white'}`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecording ? (
            <>
              <span className="w-4 h-4 rounded-sm bg-white inline-block shrink-0" />
              <span className="text-xs font-bold tracking-wide pr-1">STOP</span>
            </>
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        {/* Download button — appears after recording finishes */}
        {recordingBlob && !isRecording && (
          <>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button
              onClick={() => {
                const ext = recordingBlob.type.includes('audio') ? 'webm' : 'webm';
                const url = URL.createObjectURL(recordingBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `session-recording-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-full transition-all"
              title="Download recording"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </>
        )}

        <div className="w-px h-6 bg-white/20 mx-1" />

        <button
          onClick={handleLeave}
          className="px-6 py-3 bg-[#ea4335] hover:bg-[#d93025] text-white font-medium text-sm rounded-full transition-all flex items-center gap-2 ml-1"
          title="Leave call"
        >
          <PhoneOff className="w-4 h-4" /> End Call
        </button>

      </div>

    </div>
  );
}
