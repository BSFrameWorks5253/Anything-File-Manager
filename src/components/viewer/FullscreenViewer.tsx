import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FsItem } from '../../types';
import { isPhotoExtension, isVideoExtension, isRawExtension } from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { useVideoFrameZoom } from '../../hooks';
import { ViewerToolbar } from './ViewerToolbar';
import { ImageViewer } from './ImageViewer';
import { VideoPlayer } from './VideoPlayer';
import { VideoControlsBar } from './VideoControlsBar';

interface FullscreenViewerProps {
  item: FsItem;
  items: FsItem[];
  onClose: () => void;
  onNavigate: (target: FsItem) => void;
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  item,
  items,
  onClose,
  onNavigate
}) => {
  const isVideo = isVideoExtension(item.ext);
  const isPhoto = isPhotoExtension(item.ext);
  const isRaw = isRawExtension(item.ext);
  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);

  // RAW photo base64 high-res state
  const [rawPhotoUrl, setRawPhotoUrl] = useState<string | null>(() => {
    return isRaw ? (thumbnailService.getCached(item.fullPath)?.thumb || null) : null;
  });
  const [loadingRaw, setLoadingRaw] = useState(false);

  useEffect(() => {
    if (!isRaw) {
      setRawPhotoUrl(null);
      setLoadingRaw(false);
      return;
    }

    const cachedThumb = thumbnailService.getCached(item.fullPath)?.thumb;
    if (cachedThumb) {
      setRawPhotoUrl(cachedThumb);
    }

    let isCurrent = true;
    setLoadingRaw(true);
    mediaService.readImageBase64(item.fullPath).then(res => {
      if (isCurrent) {
        if (res.ok && res.dataUrl) {
          setRawPhotoUrl(res.dataUrl);
        }
        setLoadingRaw(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [item.fullPath, isRaw]);

  const activePhotoSrc = isRaw ? (rawPhotoUrl || '') : mediaUrl;

  // Zoom & Pan hook
  const {
    zoom,
    setZoom,
    pan,
    setPan,
    isDragging,
    resetZoom,
    zoomIn,
    zoomOut,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useVideoFrameZoom(8);

  // Video playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Photo state
  const [rotate, setRotate] = useState(0);
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);

  // Sibling media list
  const mediaList = useMemo(
    () => items.filter(f => !f.isDir && (isPhotoExtension(f.ext) || isVideoExtension(f.ext))),
    [items]
  );
  const currentIndex = mediaList.findIndex(f => f.fullPath === item.fullPath);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(mediaList[currentIndex - 1]);
  }, [currentIndex, mediaList, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < mediaList.length - 1) onNavigate(mediaList[currentIndex + 1]);
  }, [currentIndex, mediaList, onNavigate]);

  // Reset zoom & pan when item changes
  useEffect(() => {
    resetZoom();
    setRotate(0);
    setIsPlaying(true);
  }, [item.fullPath, resetZoom]);

  // Precision 1-Frame Stepping
  const stepFrame = useCallback((frames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const fps = 30;
    const newTime = Math.max(0, Math.min(duration || 99999, videoRef.current.currentTime + frames / fps));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Native High-Res Frame Snapshot
  const captureFrameSnapshot = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const v = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 1920;
      canvas.height = v.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const defaultName = `${item.name.replace(/\.[^/.]+$/, '')}_frame_${Math.round(currentTime * 1000)}ms.jpg`;
        const res = await mediaService.saveSnapshot(dataUrl, defaultName);
        if (res.ok) {
          setSnapshotFeedback('Snapshot Saved!');
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = defaultName;
          a.click();
          setSnapshotFeedback('Snapshot Downloaded!');
        }
        setTimeout(() => setSnapshotFeedback(null), 2500);
      }
    } catch (err) {
      console.error('Frame snapshot failed:', err);
    }
  }, [item.name, currentTime]);

  // Keyboard navigation & controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && isVideo) {
        e.preventDefault();
        if (isPlaying) {
          videoRef.current?.pause();
          setIsPlaying(false);
        } else {
          videoRef.current?.play();
          setIsPlaying(true);
        }
      } else if (e.key === 'ArrowLeft') {
        if (isVideo && !isPlaying) stepFrame(-1);
        else goPrev();
      } else if (e.key === 'ArrowRight') {
        if (isVideo && !isPlaying) stepFrame(1);
        else goNext();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, isVideo, duration, goPrev, goNext, stepFrame, zoomIn, zoomOut, resetZoom, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col select-none"
      onClick={onClose}
    >
      {/* Top Studio Toolbar */}
      <ViewerToolbar
        item={item}
        isVideo={isVideo}
        isPhoto={isPhoto}
        duration={duration}
        zoom={zoom}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        onResetZoom={resetZoom}
        onRotatePhoto={() => setRotate(r => (r + 90) % 360)}
        onCaptureSnapshot={captureFrameSnapshot}
        snapshotFeedback={snapshotFeedback}
        onClose={onClose}
      />

      {/* Main Viewport Stage */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-6 z-30 p-3.5 rounded-full bg-black/70 hover:bg-black/95 text-white border border-white/20 transition-all hover:scale-110 shadow-2xl"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {currentIndex < mediaList.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-6 z-30 p-3.5 rounded-full bg-black/70 hover:bg-black/95 text-white border border-white/20 transition-all hover:scale-110 shadow-2xl"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Media Rendering */}
        {isPhoto ? (
          activePhotoSrc ? (
            <ImageViewer
              src={activePhotoSrc}
              name={item.name}
              zoom={zoom}
              pan={pan}
              rotate={rotate}
              isDragging={isDragging}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-rose-300">
              <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">Extracting RAW Preview...</span>
            </div>
          )
        ) : isVideo ? (
          <VideoPlayer
            src={mediaUrl}
            videoRef={videoRef}
            zoom={zoom}
            pan={pan}
            isDragging={isDragging}
            onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
            onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration || 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        ) : null}
      </div>

      {/* Video Interactive Controls Bar */}
      {isVideo && (
        <VideoControlsBar
          isPlaying={isPlaying}
          onTogglePlay={() => {
            if (isPlaying) {
              videoRef.current?.pause();
              setIsPlaying(false);
            } else {
              videoRef.current?.play();
              setIsPlaying(true);
            }
          }}
          currentTime={currentTime}
          duration={duration}
          onSeek={val => {
            if (videoRef.current) {
              videoRef.current.currentTime = val;
              setCurrentTime(val);
            }
          }}
          onStepFrame={stepFrame}
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={v => {
            setVolume(v);
            setIsMuted(v === 0);
            if (videoRef.current) {
              videoRef.current.volume = v;
              videoRef.current.muted = v === 0;
            }
          }}
          onToggleMute={() => {
            if (isMuted) {
              setIsMuted(false);
              if (videoRef.current) videoRef.current.muted = false;
            } else {
              setIsMuted(true);
              if (videoRef.current) videoRef.current.muted = true;
            }
          }}
          playbackSpeed={playbackSpeed}
          onSpeedChange={s => {
            setPlaybackSpeed(s);
            if (videoRef.current) videoRef.current.playbackRate = s;
          }}
        />
      )}
    </div>
  );
};
