import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
  ZoomIn,
  ZoomOut,
  StepBack,
  StepForward,
  Repeat,
  X,
  Minus,
  Square
} from 'lucide-react';
import { isVideoExtension, isPhotoExtension, isRawExtension, formatTimelapse } from '../../utils';
import { mediaService } from '../../services';
import { MacTrafficLights } from '../common/MacIcons';

interface MacStandaloneMediaPlayerProps {
  filePath: string;
}

export const MacStandaloneMediaPlayer: React.FC<MacStandaloneMediaPlayerProps> = ({ filePath }) => {
  const fileName = filePath.split(/[\\/]/).filter(Boolean).pop() || filePath;
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const isVid = isVideoExtension(ext);
  const isRaw = isRawExtension(ext);
  const isImg = isPhotoExtension(ext);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Image zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [rawThumb, setRawThumb] = useState<string | null>(null);

  // Load RAW if applicable
  useEffect(() => {
    if (isRaw) {
      mediaService.readImageBase64(filePath).then(res => {
        if (res.ok && res.dataUrl) setRawThumb(res.dataUrl);
      });
    }
  }, [filePath, isRaw]);

  // Video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stepFrame = (frames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const fps = 25; // standard production framerate
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + frames / fps));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (isVid) togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepFrame(1);
      } else if (e.key === 'j' || e.key === 'J') {
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      } else if (e.key === 'l' || e.key === 'L') {
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation(prev => (prev + 90) % 360);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } else {
          document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [duration, isVid, isMuted]);

  // Autohide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const mediaSrc = isRaw && rawThumb ? rawThumb : mediaService.toLocalResourceUrl(filePath);

  return (
    <div
      onMouseMove={handleMouseMove}
      className="flex flex-col h-screen w-screen bg-[#07080b] text-neutral-100 select-none overflow-hidden font-sans relative"
    >
      {/* ── macOS Styled Draggable Window Header ── */}
      <div
        style={{ WebkitAppRegion: 'drag' } as any}
        className={`absolute top-0 left-0 right-0 z-40 h-10 px-3 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100 bg-gradient-to-b from-black/80 to-transparent' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-2">
          <MacTrafficLights
            onClose={() => mediaService.closeWindow()}
            onMinimize={() => mediaService.minimizeWindow()}
            onMaximize={() => mediaService.maximizeWindow()}
          />
        </div>

        <div className="flex items-center gap-2 max-w-md truncate">
          <span className="text-xs font-medium text-neutral-300 truncate">{fileName}</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-400">
            {ext}
          </span>
        </div>

        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-1">
          {isImg && (
            <>
              <button
                onClick={() => setZoom(prev => Math.max(0.2, prev - 0.25))}
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="text-[11px] px-1.5 py-0.5 rounded hover:bg-white/10 font-mono text-neutral-400 hover:text-white"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main Media Canvas ── */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden cursor-default relative"
        onClick={isVid ? togglePlay : undefined}
      >
        {isVid ? (
          <video
            ref={videoRef}
            src={mediaSrc}
            loop={isLooping}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="max-h-full max-w-full object-contain"
            autoPlay
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onMouseDown={e => {
              if (zoom > 1) {
                setIsDragging(true);
                dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
              }
            }}
            onMouseMove={e => {
              if (isDragging && zoom > 1) {
                setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <img
              src={mediaSrc}
              alt={fileName}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
              className="max-h-full max-w-full object-contain select-none cursor-grab active:cursor-grabbing"
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* ── Floating macOS QuickTime Style Video Transport Bar ── */}
      {isVid && (
        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 shadow-2xl p-3 flex flex-col gap-2 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Scrubber Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-medium text-neutral-400 w-12 text-right">
              {formatTimelapse(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-[var(--mac-accent,#0071e3)] h-1 bg-white/20 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono font-medium text-neutral-400 w-12">
              {formatTimelapse(duration)}
            </span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {/* Frame Back */}
              <button
                onClick={() => stepFrame(-1)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                title="Previous Frame (Left Arrow)"
              >
                <StepBack className="w-4 h-4" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="p-2 rounded-xl bg-white text-black hover:bg-neutral-200 transition-transform active:scale-95 shadow"
                title="Play / Pause (Space)"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black translate-x-0.5" />}
              </button>

              {/* Frame Forward */}
              <button
                onClick={() => stepFrame(1)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                title="Next Frame (Right Arrow)"
              >
                <StepForward className="w-4 h-4" />
              </button>

              {/* Loop */}
              <button
                onClick={() => setIsLooping(prev => !prev)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isLooping ? 'bg-[var(--mac-accent)] text-white' : 'hover:bg-white/10 text-neutral-400 hover:text-white'
                }`}
                title="Loop Video"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Speed & Volume */}
            <div className="flex items-center gap-3">
              {/* Playback Speed Pill */}
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-[10px] font-bold font-mono">
                {[0.5, 1, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      playbackRate === rate ? 'bg-white text-black shadow' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 accent-[var(--mac-accent)] h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
