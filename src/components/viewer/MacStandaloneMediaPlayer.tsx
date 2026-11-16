import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Camera,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  Check
} from 'lucide-react';
import { FsItem } from '../../types';
import { isVideoExtension, isPhotoExtension, isRawExtension, formatTimelapse, formatBytes } from '../../utils';
import { mediaService } from '../../services';
import { MacTrafficLights } from '../common/MacIcons';
import { LutSelectorPill } from '../common/LutSelectorPill';
import { getLutFilterStyle } from '../../utils/lutFilters';
import { AudioWaveformBar } from '../common/AudioWaveformBar';
import { NleShuttleBadge } from '../common/NleShuttleBadge';

interface MacStandaloneMediaPlayerProps {
  filePath: string;
}

export const MacStandaloneMediaPlayer: React.FC<MacStandaloneMediaPlayerProps> = ({ filePath: initialFilePath }) => {
  const [currentFilePath, setCurrentFilePath] = useState(initialFilePath);
  const [siblingFiles, setSiblingFiles] = useState<FsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fileName = currentFilePath.split(/[\\/]/).filter(Boolean).pop() || currentFilePath;
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
  const [isLooping, setIsLooping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedLut, setSelectedLut] = useState<string>('off');
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [metaInfo, setMetaInfo] = useState<{ width?: number; height?: number; fps?: number } | null>(null);

  // NLE J-K-L Shuttle Engine
  const [shuttleSpeed, setShuttleSpeed] = useState<number>(1);
  const [isFrameStep, setIsFrameStep] = useState<-1 | 1 | null>(null);
  const [shuttleTriggerKey, setShuttleTriggerKey] = useState<number>(0);
  const reverseTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Image zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [rawThumb, setRawThumb] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sibling media files in the folder for Next/Previous navigation
  useEffect(() => {
    mediaService.getSiblingMediaFiles(currentFilePath).then(res => {
      if (res.ok && res.items.length > 0) {
        setSiblingFiles(res.items);
        const idx = res.items.findIndex(
          i => i.fullPath.toLowerCase() === currentFilePath.toLowerCase()
        );
        if (idx !== -1) setCurrentIndex(idx);
      }
    });
  }, [currentFilePath]);

  // Load RAW if applicable
  useEffect(() => {
    if (isRaw) {
      mediaService.readImageBase64(currentFilePath).then(res => {
        if (res.ok && res.dataUrl) setRawThumb(res.dataUrl);
      });
    } else {
      setRawThumb(null);
    }
  }, [currentFilePath, isRaw]);

  // Reset view on item change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setCurrentTime(0);
    setShuttleSpeed(1);
    if (reverseTickerRef.current) clearInterval(reverseTickerRef.current);
  }, [currentFilePath]);

  const handleNextMedia = useCallback(() => {
    if (siblingFiles.length === 0) return;
    const nextIdx = (currentIndex + 1) % siblingFiles.length;
    setCurrentIndex(nextIdx);
    setCurrentFilePath(siblingFiles[nextIdx].fullPath);
  }, [siblingFiles, currentIndex]);

  const handlePrevMedia = useCallback(() => {
    if (siblingFiles.length === 0) return;
    const prevIdx = currentIndex <= 0 ? siblingFiles.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIdx);
    setCurrentFilePath(siblingFiles[prevIdx].fullPath);
  }, [siblingFiles, currentIndex]);

  // Video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setMetaInfo({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  const stopReverseTicker = () => {
    if (reverseTickerRef.current) {
      clearInterval(reverseTickerRef.current);
      reverseTickerRef.current = null;
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    stopReverseTicker();
    if (videoRef.current.paused) {
      videoRef.current.playbackRate = 1;
      videoRef.current.play();
      setIsPlaying(true);
      setShuttleSpeed(1);
      setIsFrameStep(null);
      setShuttleTriggerKey(k => k + 1);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShuttleSpeed(0);
      setIsFrameStep(null);
      setShuttleTriggerKey(k => k + 1);
    }
  }, []);

  // J-K-L Shuttle Implementation
  const handleShuttleForward = useCallback(() => {
    if (!videoRef.current) return;
    stopReverseTicker();
    let nextSpeed = 1;
    if (!isPlaying || shuttleSpeed <= 0) {
      nextSpeed = 1;
    } else if (shuttleSpeed === 1) {
      nextSpeed = 2;
    } else if (shuttleSpeed === 2) {
      nextSpeed = 4;
    } else if (shuttleSpeed === 4) {
      nextSpeed = 8;
    } else {
      nextSpeed = 8;
    }

    videoRef.current.playbackRate = nextSpeed;
    videoRef.current.play();
    setIsPlaying(true);
    setShuttleSpeed(nextSpeed);
    setIsFrameStep(null);
    setShuttleTriggerKey(k => k + 1);
  }, [isPlaying, shuttleSpeed]);

  const handleShuttlePause = useCallback(() => {
    if (!videoRef.current) return;
    stopReverseTicker();
    videoRef.current.pause();
    setIsPlaying(false);
    setShuttleSpeed(0);
    setIsFrameStep(null);
    setShuttleTriggerKey(k => k + 1);
  }, []);

  const handleShuttleReverse = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);

    let nextSpeed = -1;
    if (shuttleSpeed >= 0) {
      nextSpeed = -1;
    } else if (shuttleSpeed === -1) {
      nextSpeed = -2;
    } else if (shuttleSpeed === -2) {
      nextSpeed = -4;
    } else {
      nextSpeed = -8;
    }

    setShuttleSpeed(nextSpeed);
    setIsFrameStep(null);
    setShuttleTriggerKey(k => k + 1);

    stopReverseTicker();
    const stepInterval = 40; // ms
    const stepSeconds = (Math.abs(nextSpeed) * stepInterval) / 1000;
    reverseTickerRef.current = setInterval(() => {
      if (videoRef.current) {
        if (videoRef.current.currentTime <= 0.05) {
          stopReverseTicker();
          setShuttleSpeed(0);
          setShuttleTriggerKey(k => k + 1);
        } else {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - stepSeconds);
        }
      }
    }, stepInterval);
  }, [shuttleSpeed]);

  const stepFrame = useCallback((frames: number) => {
    if (!videoRef.current) return;
    stopReverseTicker();
    videoRef.current.pause();
    setIsPlaying(false);
    setShuttleSpeed(0);
    const fps = 25;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + frames / fps));
    setIsFrameStep(frames > 0 ? 1 : -1);
    setShuttleTriggerKey(k => k + 1);
  }, [duration]);

  const handleSeek = (val: number) => {
    stopReverseTicker();
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

  const handleSnapshot = async () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply LUT filter to snapshot if active
      if (selectedLut !== 'off') {
        const lutStyle = getLutFilterStyle(selectedLut);
        if (lutStyle.filter) ctx.filter = lutStyle.filter as string;
      }

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const defName = `${fileName.replace(/\.[^.]+$/, '')}_snap_${Math.round(currentTime)}s.jpg`;
      const res = await mediaService.saveSnapshot(dataUrl, defName);
      if (res.ok) {
        setSnapshotSuccess(true);
        setTimeout(() => setSnapshotSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Snapshot failed:', err);
    }
  };

  // Keyboard controls (J-K-L, Space, Arrows, [, ], F, M)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (isVid) togglePlay();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (isVid) handleShuttlePause();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (isVid) handleShuttleForward();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (isVid) handleShuttleReverse();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isVid) stepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isVid) stepFrame(1);
      } else if (e.key === '[' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevMedia();
      } else if (e.key === ']' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextMedia();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation(prev => (prev + 90) % 360);
      } else if (e.key === 'i' || e.key === 'I') {
        setShowMetadata(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    isVid,
    togglePlay,
    handleShuttleForward,
    handleShuttlePause,
    handleShuttleReverse,
    stepFrame,
    handleNextMedia,
    handlePrevMedia
  ]);

  // Autohide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  };

  const mediaSrc = isRaw && rawThumb ? rawThumb : mediaService.toLocalResourceUrl(currentFilePath);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => Math.max(0.5, Math.min(6, Math.round((prev + delta) * 10) / 10)));
  };

  const lutStyle = getLutFilterStyle(selectedLut);

  return (
    <div
      onMouseMove={handleMouseMove}
      className="flex flex-col h-screen w-screen bg-[#05070a] text-neutral-100 select-none overflow-hidden font-sans relative"
    >
      {/* ── macOS Styled Draggable Window Header Bar ── */}
      <div
        style={{ WebkitAppRegion: 'drag' } as any}
        className={`absolute top-0 left-0 right-0 z-40 h-11 px-3 flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100 bg-gradient-to-b from-black/90 via-black/50 to-transparent' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Traffic Lights & Sibling Arrows */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-3">
          <MacTrafficLights
            onClose={() => mediaService.closeWindow()}
            onMinimize={() => mediaService.minimizeWindow()}
            onMaximize={() => mediaService.maximizeWindow()}
          />

          {siblingFiles.length > 1 && (
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 ml-2 border border-white/10">
              <button
                onClick={handlePrevMedia}
                className="p-1 rounded hover:bg-white/15 text-neutral-300 hover:text-white transition-colors"
                title="Previous Clip ([ or PageUp)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-medium text-neutral-400 px-1">
                {currentIndex + 1}/{siblingFiles.length}
              </span>
              <button
                onClick={handleNextMedia}
                className="p-1 rounded hover:bg-white/15 text-neutral-300 hover:text-white transition-colors"
                title="Next Clip (] or PageDown)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: File Name & Codec Tag */}
        <div className="flex items-center gap-2 max-w-lg truncate px-2">
          <span className="text-xs font-semibold text-neutral-200 truncate">{fileName}</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/15 text-neutral-300 font-bold border border-white/10">
            {ext}
          </span>
          {metaInfo?.width && (
            <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">
              {metaInfo.width}×{metaInfo.height}
            </span>
          )}
        </div>

        {/* Right: Quick LUT Selector & Tools */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-2">
          {/* Live Camera LOG to Rec.709 LUT Selector */}
          <LutSelectorPill currentLut={selectedLut} onSelectLut={setSelectedLut} />

          {/* Snapshot / Frame Capture */}
          {isVid && (
            <button
              onClick={handleSnapshot}
              className={`p-1.5 rounded-xl border transition-colors flex items-center gap-1 text-xs ${
                snapshotSuccess
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/10 hover:bg-white/15 border-white/10 text-neutral-300 hover:text-white'
              }`}
              title="Save Full-Res Frame Snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden md:inline">
                {snapshotSuccess ? 'Saved!' : 'Snapshot'}
              </span>
            </button>
          )}

          {/* Toggle Metadata Drawer */}
          <button
            onClick={() => setShowMetadata(prev => !prev)}
            className={`p-1.5 rounded-xl border transition-colors ${
              showMetadata
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-white/10 hover:bg-white/15 border-white/10 text-neutral-300 hover:text-white'
            }`}
            title="Toggle Clip Info / Metadata (I)"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Media Canvas ── */}
      <div
        onWheel={handleWheel}
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
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.1s ease-out',
              ...lutStyle
            }}
            className="max-h-full max-w-full object-contain drop-shadow-2xl"
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
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                ...lutStyle
              }}
              className="max-h-full max-w-full object-contain select-none cursor-grab active:cursor-grabbing drop-shadow-2xl"
              draggable={false}
            />
          </div>
        )}

        {/* NLE Shuttle HUD Notification (J-K-L feedback pill) */}
        <NleShuttleBadge
          shuttleSpeed={shuttleSpeed}
          isFrameStep={isFrameStep}
          triggerKey={shuttleTriggerKey}
        />
      </div>

      {/* ── Floating Metadata Drawer (Top Right overlay) ── */}
      {showMetadata && (
        <div className="absolute top-14 right-4 z-40 w-72 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/15 p-3.5 shadow-2xl flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-bold uppercase tracking-wider text-neutral-400">
            <span>Asset Inspector</span>
            <button onClick={() => setShowMetadata(false)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-neutral-400">Resolution:</span>
              <span className="text-white">{metaInfo?.width ? `${metaInfo.width} × ${metaInfo.height}` : '—'}</span>
            </div>
            {duration > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Duration:</span>
                <span className="text-white">{formatTimelapse(duration)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-400">Extension:</span>
              <span className="text-white uppercase font-bold">{ext}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Active LUT:</span>
              <span className="text-amber-300 font-bold uppercase">{selectedLut}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">File Path:</span>
              <span className="text-neutral-300 truncate max-w-[150px]" title={currentFilePath}>{currentFilePath}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating macOS QuickTime Style Video Transport Bar ── */}
      {isVid && (
        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/15 shadow-2xl p-3 flex flex-col gap-2 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Interactive Audio Waveform Scrubber */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono font-bold text-neutral-300 w-12 text-right">
              {formatTimelapse(currentTime)}
            </span>
            <div className="flex-1">
              <AudioWaveformBar
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSeek}
                seedPath={currentFilePath}
              />
            </div>
            <span className="text-[11px] font-mono font-medium text-neutral-400 w-12">
              {formatTimelapse(duration)}
            </span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between px-1 pt-1">
            {/* Play, Step, J-K-L controls */}
            <div className="flex items-center gap-1.5">
              {/* Shuttle Reverse (J) */}
              <button
                onClick={handleShuttleReverse}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                title="Shuttle Reverse (J)"
              >
                <StepBack className="w-4 h-4" />
              </button>

              {/* Frame Back (Left Arrow) */}
              <button
                onClick={() => stepFrame(-1)}
                className="p-1 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-[10px] font-mono font-bold"
                title="Previous Frame (←)"
              >
                -1F
              </button>

              {/* Play / Pause (Space or K) */}
              <button
                onClick={togglePlay}
                className="p-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition-transform active:scale-95 shadow-md mx-1"
                title="Play / Pause (Space or K)"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black translate-x-0.5" />}
              </button>

              {/* Frame Forward (Right Arrow) */}
              <button
                onClick={() => stepFrame(1)}
                className="p-1 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors text-[10px] font-mono font-bold"
                title="Next Frame (→)"
              >
                +1F
              </button>

              {/* Shuttle Forward (L) */}
              <button
                onClick={handleShuttleForward}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                title="Shuttle Forward (L)"
              >
                <StepForward className="w-4 h-4" />
              </button>

              {/* Loop */}
              <button
                onClick={() => setIsLooping(prev => !prev)}
                className={`p-1.5 rounded-lg transition-colors ml-1 ${
                  isLooping ? 'bg-[var(--mac-accent,#0071e3)] text-white shadow' : 'hover:bg-white/10 text-neutral-400 hover:text-white'
                }`}
                title="Loop Video"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Speed & Volume */}
            <div className="flex items-center gap-3">
              {/* Playback Speed Indicator / Selector */}
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 text-[10px] font-bold font-mono">
                {[1, 2, 4].map(rate => (
                  <button
                    key={rate}
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.playbackRate = rate;
                        videoRef.current.play();
                        setIsPlaying(true);
                        setShuttleSpeed(rate);
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      shuttleSpeed === rate && isPlaying ? 'bg-white text-black shadow' : 'text-neutral-400 hover:text-white'
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
                  title="Mute / Unmute (M)"
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
                  className="w-16 accent-[var(--mac-accent,#0071e3)] h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
