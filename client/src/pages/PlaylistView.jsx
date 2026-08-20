import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Loader2, ArrowLeft, Edit2, Trash2, ThumbsUp, Play, X, PictureInPicture } from 'lucide-react';

export default function PlaylistView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [liking, setLiking] = useState(false);
  
  // Modal & Focus state
  const [activeVideo, setActiveVideo] = useState(null);
  const [lastActiveVideoId, setLastActiveVideoId] = useState(null);
  
  // Iframe error handling state
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  
  // PiP state
  const iframeRef = useRef(null);
  const iframeContainerRef = useRef(null);
  const pipWindowRef = useRef(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [pipFallbackVisible, setPipFallbackVisible] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);

  // Playback Progress state
  const ytPlayerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const localTimeIntervalRef = useRef(null);
  const savedProgressRef = useRef(0);
  const localTimeRef = useRef(0);
  const durationRef = useRef(0);
  const activeVideoRef = useRef(null);

  // Load YT API globally
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Update ref for cleanup closures
  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  // Fetch saved progress when opening a video
  useEffect(() => {
    if (activeVideo) {
      savedProgressRef.current = 0;
      localTimeRef.current = 0;
      durationRef.current = 0;
      api.get(`/progress/${activeVideo.videoId}`)
        .then(res => {
          savedProgressRef.current = res.data.positionSeconds || 0;
          if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function' && savedProgressRef.current > 0) {
            ytPlayerRef.current.seekTo(savedProgressRef.current, true);
          }
        })
        .catch(err => console.error('Error fetching progress', err));
    }
  }, [activeVideo]);

  const saveProgress = async (vidId) => {
    if (!vidId) return;
    try {
      const currentTime = localTimeRef.current;
      const duration = durationRef.current;
      
      let positionToSave = currentTime;
      // Treat as finished if within 5 seconds of the end
      if (duration && (duration - currentTime < 5)) {
        positionToSave = 0;
      }
      
      // Don't save if it's practically at the start (e.g., < 2s) and not resetting
      if (positionToSave < 2 && positionToSave !== 0) return;

      await api.put(`/progress/${vidId}`, { positionSeconds: positionToSave });
    } catch (err) {
      console.error('Failed to save progress', err);
    }
  };

  // Best-effort check for Google's PiP Chrome Extension
  useEffect(() => {
    const checkExtension = async () => {
      try {
        // This fetch will only succeed if the extension explicitly exposes manifest.json via web_accessible_resources
        const res = await fetch('chrome-extension://hkgfoiooedgoejojocmhlaklaeopbecg/manifest.json', { method: 'HEAD' });
        if (res.ok) setExtensionDetected(true);
      } catch (err) {
        // Expected behavior for most setups (blocked by CORS/browser security). Treat as unknown.
        setExtensionDetected(false);
      }
    };
    checkExtension();
  }, []);

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        const { data } = await api.get(`/playlists/${id}`);
        setPlaylist(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load playlist');
      } finally {
        setLoading(false);
      }
    };
    fetchPlaylist();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;
    setDeleting(true);
    try {
      await api.delete(`/playlists/${id}`);
      navigate('/playlister');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete playlist');
      setDeleting(false);
    }
  };

  const handleLike = async () => {
    if (liking || !playlist) return;
    setLiking(true);
    // Optimistic update
    const previousState = { ...playlist };
    setPlaylist(prev => ({
      ...prev,
      likeCount: prev.isLikedByMe ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
      isLikedByMe: !prev.isLikedByMe
    }));

    try {
      const { data } = await api.post(`/playlists/${id}/like`);
      setPlaylist(prev => ({
        ...prev,
        likeCount: data.likeCount,
        isLikedByMe: data.isLikedByMe
      }));
    } catch (err) {
      // Revert on error
      setPlaylist(previousState);
      alert(err.response?.data?.message || 'Failed to toggle like');
    } finally {
      setLiking(false);
    }
  };

  // Close modal when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveVideo(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus management
  useEffect(() => {
    if (activeVideo) {
      setLastActiveVideoId(activeVideo.videoId);
      // Reset iframe state for the new video
      setIframeLoaded(false);
      setIframeError(false);
      setPipFallbackVisible(false);
      
      // Move focus to the close button inside the modal
      const closeBtn = document.getElementById('modal-close-btn');
      if (closeBtn) closeBtn.focus();
    } else if (lastActiveVideoId) {
      // Return focus to the triggering card
      const triggerBtn = document.getElementById(`video-btn-${lastActiveVideoId}`);
      if (triggerBtn) triggerBtn.focus();
    }
  }, [activeVideo, lastActiveVideoId]);

  // Iframe timeout / error fallback & YT Player initialization
  useEffect(() => {
    let timer;
    let pollInterval;
    let player;

    if (activeVideo && !iframeError) {
      // 1. Setup error fallback timeout
      timer = setTimeout(() => {
        if (!iframeLoaded) setIframeError(true);
      }, 8000);

      // 2. Initialize YT Player once the iframe is in the DOM
      const tryInit = () => {
        if (window.YT && window.YT.Player && iframeRef.current) {
          player = new window.YT.Player(iframeRef.current, {
            events: {
              'onReady': (event) => {
                setIframeLoaded(true);
                if (savedProgressRef.current > 0) {
                  event.target.seekTo(savedProgressRef.current, true);
                }
              },
              'onStateChange': (event) => {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  durationRef.current = player.getDuration() || 0;
                  
                  if (!localTimeIntervalRef.current) {
                    localTimeIntervalRef.current = setInterval(() => {
                      if (player && typeof player.getCurrentTime === 'function') {
                        const t = player.getCurrentTime();
                        if (t > 0) localTimeRef.current = t;
                      }
                    }, 1000);
                  }

                  if (!progressIntervalRef.current) {
                    progressIntervalRef.current = setInterval(() => {
                      saveProgress(activeVideoRef.current?.videoId);
                    }, 10000);
                  }
                } else {
                  if (localTimeIntervalRef.current) {
                    clearInterval(localTimeIntervalRef.current);
                    localTimeIntervalRef.current = null;
                  }
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                  }
                  
                  if (player && typeof player.getCurrentTime === 'function') {
                    const t = player.getCurrentTime();
                    if (t > 0) localTimeRef.current = t;
                  }

                  if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                    saveProgress(activeVideoRef.current?.videoId);
                  }
                }
              }
            }
          });
          ytPlayerRef.current = player;
          if (pollInterval) clearInterval(pollInterval);
        }
      };

      pollInterval = setInterval(tryInit, 200);
    }

    return () => {
      clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (localTimeIntervalRef.current) clearInterval(localTimeIntervalRef.current);
      
      saveProgress(activeVideoRef.current?.videoId);
      ytPlayerRef.current = null;
    };
  }, [activeVideo, iframeError, iframeLoaded]);

  // Ensure PiP closes if activeVideo is closed
  useEffect(() => {
    if (!activeVideo && pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPipActive(false);
    }
  }, [activeVideo]);

  const handlePiP = async () => {
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 640,
          height: 360,
        });
        pipWindowRef.current = pipWindow;
        
        // Copy styles to pip window to ensure iframe stretches
        const style = pipWindow.document.createElement('style');
        style.textContent = `
          body { margin: 0; padding: 0; background: black; overflow: hidden; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
          iframe { width: 100%; height: 100%; border: none; }
        `;
        pipWindow.document.head.appendChild(style);
        
        // Move iframe to PiP
        if (iframeRef.current) {
          pipWindow.document.body.appendChild(iframeRef.current);
          setIsPipActive(true);
        }
        
        pipWindow.addEventListener('pagehide', () => {
          // Move iframe back
          if (iframeContainerRef.current && iframeRef.current) {
            iframeContainerRef.current.appendChild(iframeRef.current);
          }
          pipWindowRef.current = null;
          setIsPipActive(false);
        });
        
        return; // Successfully entered PiP, exit early
      } catch (err) {
        console.error('Failed to enter Document PiP:', err);
        // Fall through to show the fallback panel
      }
    }
    
    // If native PiP is unsupported or failed, show the fallback tooltip
    setPipFallbackVisible(true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading playlist...</span>
    </div>
  );

  if (error || !playlist) return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <div className="px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
        {error || 'Playlist not found'}
      </div>
      <Link to="/playlister" className="mt-4 inline-flex items-center text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Playlister
      </Link>
    </div>
  );

  const isCreator = user && playlist.creatorId?._id === user._id;

  return (
    <>
      <div className="w-full max-w-5xl mx-auto px-6 py-10 sm:px-8">
        <Link to="/playlister" className="inline-flex items-center text-sm text-brand-muted hover:text-brand-text transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Playlister
        </Link>

        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-medium tracking-tight text-brand-text mb-3 leading-tight">
                {playlist.title}
              </h1>
              <p className="text-sm text-brand-muted whitespace-pre-wrap leading-relaxed max-w-3xl">
                {playlist.description || <span className="italic opacity-60">No description provided.</span>}
              </p>
            </div>
            
            <button 
              onClick={handleLike}
              disabled={liking}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all shrink-0 ${playlist.isLikedByMe ? 'bg-brand-text border-brand-text text-brand-bg' : 'bg-brand-surface border-black/[0.12] text-brand-text hover:border-black/[0.24]'}`}
            >
              <ThumbsUp className={`w-4 h-4 ${playlist.isLikedByMe ? 'fill-brand-bg' : ''}`} />
              <span className="text-sm font-medium">{playlist.likeCount} {playlist.likeCount === 1 ? 'Like' : 'Likes'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.08] pb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-black/[0.08] flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-brand-muted">
                  {(playlist.creatorId?.name || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-brand-text">
                  {playlist.creatorId?.name || 'Unknown'}
                </p>
                <p className="text-xs text-brand-faint">
                  {new Date(playlist.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            {isCreator && (
              <div className="flex items-center gap-2">
                <Link to={`/playlister/${playlist._id}/edit`} className="btn-secondary px-3 py-1.5 text-xs">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Link>
                <button 
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-danger px-3 py-1.5 text-xs"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-xl font-medium text-brand-text">
            {playlist.videos.length} Video{playlist.videos.length !== 1 && 's'}
          </h2>
          {playlist.videos.length === 0 ? (
            <p className="text-sm text-brand-muted">No videos in this playlist.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {playlist.videos.map((vid, idx) => {
                const thumbnailUrl = `https://img.youtube.com/vi/${vid.videoId}/hqdefault.jpg`;
                const displayTitle = vid.title || `Video ${idx + 1}`;
                
                return (
                  <button 
                    key={vid.videoId || idx} 
                    id={`video-btn-${vid.videoId}`}
                    className="flex flex-col gap-3 group cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-brand-text/40 rounded-[12px] transition-shadow"
                    onClick={() => setActiveVideo(vid)}
                    aria-label={`Play ${displayTitle}`}
                  >
                    <div className="relative w-full aspect-video bg-brand-surface-2 rounded-[12px] overflow-hidden shadow-sm border border-black/[0.08] group-hover:border-black/[0.16] transition-all">
                      <img 
                        src={thumbnailUrl} 
                        alt=""
                        loading="lazy" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-brand-text group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 ml-1" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded">
                        {idx + 1}
                      </div>
                    </div>
                    <div className="px-1 w-full">
                      <p className="text-sm font-medium text-brand-text line-clamp-2 group-hover:text-brand-line transition-colors">
                        {vid.title || vid.url}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Video Modal / Lightbox */}
      {activeVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8 backdrop-blur-sm"
          onClick={() => setActiveVideo(null)}
        >
          {/* PiP Button */}
          {iframeLoaded && !iframeError && (
            <div className="absolute top-4 right-16 z-50">
              <button 
                onClick={(e) => { e.stopPropagation(); handlePiP(); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Picture-in-Picture"
                title="Picture-in-Picture"
              >
                <PictureInPicture className="w-5 h-5" aria-hidden="true" />
              </button>

              {/* PiP Fallback Panel */}
              {pipFallbackVisible && (
                <div 
                  className="absolute top-12 right-0 w-72 bg-[#1e1e1e] border border-white/10 rounded-[12px] shadow-2xl p-4 text-left z-50 mt-2 origin-top-right transition-all"
                  onClick={e => e.stopPropagation()}
                >
                  <button 
                    onClick={() => setPipFallbackVisible(false)}
                    className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors"
                    aria-label="Close message"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-sm text-white font-medium mb-2 pr-4">
                    Native Picture-in-Picture isn't available for this video in your browser.
                  </p>
                  
                  {!extensionDetected && (
                    <a 
                      href="https://chromewebstore.google.com/detail/picture-in-picture-extens/hkgfoiooedgoejojocmhlaklaeopbecg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-400 hover:text-blue-300 underline mb-3"
                    >
                      Get the Picture-in-Picture extension
                    </a>
                  )}
                  
                  <p className="text-xs text-white/70 bg-white/5 p-2 rounded-[8px]">
                    If you already have it, press <kbd className="font-sans px-1 rounded bg-black/50 border border-white/20">Alt+P</kbd> (or <kbd className="font-sans px-1 rounded bg-black/50 border border-white/20">⌥+P</kbd> on Mac) or click its icon in your toolbar while the video is playing.
                  </p>
                </div>
              )}
            </div>
          )}

          <button 
            id="modal-close-btn"
            onClick={() => setActiveVideo(null)}
            className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close viewer"
            title="Close viewer"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
          
          <div 
            ref={iframeContainerRef}
            className="relative w-full max-w-6xl aspect-video bg-black rounded-[12px] overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center" 
            onClick={e => e.stopPropagation()}
          >
            {isPipActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-0 text-white/50">
                <PictureInPicture className="w-12 h-12 mb-3 opacity-50" />
                <p>Playing in Picture-in-Picture</p>
              </div>
            )}

            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
              </div>
            )}

            {iframeError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#111] text-white">
                <p className="text-xl font-medium mb-3">Video unavailable or failed to load.</p>
                <p className="text-sm text-white/60 mb-6 max-w-md">The video might be private, deleted, or its owner disabled embedding.</p>
                <a 
                  href={activeVideo.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-6 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  Watch on YouTube
                </a>
              </div>
            ) : (
              <iframe 
                id={`yt-player-${activeVideo.videoId}`}
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}`} 
                title={activeVideo.title || "YouTube video"} 
                className={`w-full h-full border-0 relative z-10 transition-opacity duration-300 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" 
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                // The YT API will handle onLoad (onReady) but this provides a safety fallback
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

