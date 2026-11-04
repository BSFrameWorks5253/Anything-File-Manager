import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Clock,
  Film,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Camera,
  Copy,
  Check,
  Music,
  FileCode,
  FileText,
  Table,
  Archive,
  Terminal,
  ExternalLink,
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  FolderOpen,
  AlertCircle
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  isRawExtension,
  isAudioExtension,
  isCodeOrTextExtension,
  isArchiveExtension,
  formatBytes,
  formatDate,
  formatTimelapse
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { classifyFolder } from '../../utils/afmTaxonomy';
import { MacFolderIcon, MacDocumentIcon } from '../common/MacIcons';

interface QuickLookModalProps {
  item: FsItem | null;
  items?: FsItem[];
  isOpen: boolean;
  onClose: () => void;
  onOpenViewer: (item: FsItem) => void;
  onNavigate?: (item: FsItem) => void;
}

/**
 * Format seconds to SMPTE Timecode: HH:MM:SS:FF (assuming 30 fps)
 */
function toSMPTETimecode(seconds: number, fps = 30): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00:00:00';
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSecs = Math.floor(seconds);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hours = Math.floor(totalSecs / 3600);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  item,
  items = [],
  isOpen,
  onClose,
  onOpenViewer,
  onNavigate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // File type categorizations
  const ext = (item?.ext || '').toLowerCase();
  const isVid = item ? isVideoExtension(ext) : false;
  const isRaw = item ? isRawExtension(ext) : false;
  const isPhoto = item ? isPhotoExtension(ext) && !isRaw : false;
  const isAudio = item ? isAudioExtension(ext) : false;
  const isPdf = ext === 'pdf';
  const isCsv = ext === 'csv' || ext === 'tsv';
  const isCodeOrText = item ? isCodeOrTextExtension(ext) || ext === 'txt' || ext === 'md' : false;
  const isArchive = item ? isArchiveExtension(ext) : false;
  const isApp = ext === 'exe' || ext === 'msi' || ext === 'bat' || ext === 'cmd';

  // Navigation list (all items in folder including subfolders)
  const navList = useMemo(() => items, [items]);
  const currentIndex = navList.findIndex(f => f.fullPath === item?.fullPath);

  const goPrev = useCallback(() => {
    if (currentIndex > 0 && onNavigate) {
      onNavigate(navList[currentIndex - 1]);
    }
  }, [currentIndex, navList, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < navList.length - 1 && onNavigate) {
      onNavigate(navList[currentIndex + 1]);
    }
  }, [currentIndex, navList, onNavigate]);

  // Global hotkeys for Quick Look: Space / Esc to close, Arrows / Tab to navigate, K to stop/play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Space' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          goPrev();
        } else {
          goNext();
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('quicklook:toggle-play'));
      } else if (e.key === 'Enter' && item) {
        e.preventDefault();
        onClose();
        mediaService.openSeparatePlayer(item.fullPath);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goPrev, goNext, item, onOpenViewer]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`bg-[#141622]/95 border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-200 ${
          isExpanded ? 'w-[97vw] h-[94vh]' : 'max-w-5xl w-full h-[85vh] max-h-[860px]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── macOS Finder Style Top Titlebar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#181b2a] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:opacity-80 cursor-pointer"
              onClick={onClose}
              title="Close (Esc or Space)"
            />
            <div
              className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:opacity-80 cursor-pointer"
              onClick={() => setIsExpanded(p => !p)}
              title="Toggle Size"
            />
            <div
              className="w-3 h-3 rounded-full bg-[#27c93f] hover:opacity-80 cursor-pointer"
              onClick={() => {
                onClose();
                mediaService.openSeparatePlayer(item.fullPath);
              }}
              title="Open in Separate Window"
            />
            <span className="text-xs font-semibold text-gray-200 ml-2 truncate max-w-sm" title={item.name}>
              {item.name}
            </span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex-shrink-0">
              Quick Look
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Prev / Next items */}
            {navList.length > 1 && (
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                <button
                  onClick={goPrev}
                  disabled={currentIndex <= 0}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-gray-300 hover:text-white"
                  title="Previous (Left Arrow)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-gray-400 font-mono px-1">
                  {currentIndex + 1} / {navList.length}
                </span>
                <button
                  onClick={goNext}
                  disabled={currentIndex >= navList.length - 1}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-gray-300 hover:text-white"
                  title="Next (Right Arrow)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Expand / Minimize modal size */}
            <button
              onClick={() => setIsExpanded(p => !p)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
              title={isExpanded ? 'Restore Size' : 'Expand Preview'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Open in Viewer / Native App */}
            <button
              onClick={() => {
                onClose();
                if (isVid || isPhoto || isRaw) {
                  mediaService.openSeparatePlayer(item.fullPath);
                } else {
                  mediaService.openExternal(item.fullPath);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--mac-accent)] hover:opacity-90 text-white rounded-md text-xs font-medium shadow-sm transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{isVid || isPhoto || isRaw ? 'Open in Player Window' : 'Open in App'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Dynamic Universal Preview Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col bg-black/90 relative">
          {item.isDir ? (
            /* 0. Folder / Directory Quick Look */
            <FolderQuickLook item={item} onClose={onClose} onNavigate={onNavigate} />
          ) : isVid ? (
            /* 1. Adobe Premiere Pro / Timeline Video Preview */
            <AdobePremiereQuickLook item={item} />
          ) : isRaw ? (
            /* 2. Camera RAW Photo (.CR3, .CR2, .NEF, etc.) */
            <CameraRawQuickLook item={item} />
          ) : isPhoto ? (
            /* 3. Standard Photos (JPG, PNG, WEBP, GIF, SVG) */
            <StandardPhotoQuickLook item={item} />
          ) : isAudio ? (
            /* 4. Audio Files (MP3, WAV, FLAC, M4A) */
            <AudioQuickLook item={item} />
          ) : isPdf ? (
            /* 5. PDF Documents */
            <PdfQuickLook item={item} />
          ) : isCsv ? (
            /* 6. CSV / TSV Data Table */
            <CsvQuickLook item={item} />
          ) : isCodeOrText ? (
            /* 7. Code & Text Files */
            <CodeTextQuickLook item={item} />
          ) : isApp ? (
            /* 8. Executable / App Files */
            <AppQuickLook item={item} />
          ) : isArchive ? (
            /* 9. Archives (.zip, .rar, .7z) */
            <ArchiveQuickLook item={item} />
          ) : (
            /* 10. Generic Universal File Inspector */
            <GenericFileQuickLook item={item} />
          )}
        </div>

        {/* ── Bottom Information Footer ── */}
        <div className="px-5 py-2.5 border-t border-white/10 bg-[#161826] flex items-center justify-between text-xs text-gray-300 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Size: <strong className="text-white font-mono">{formatBytes(item.size)}</strong>
            </span>
            <span>
              Modified: <strong className="text-white font-mono">{formatDate(item.mtime)}</strong>
            </span>
            <span className="uppercase text-indigo-400 font-bold">{item.ext}</span>
          </div>
          <span className="text-[11px] text-gray-400">
            <strong>Space</strong> close • <strong>Arrows / Tab</strong> navigate • <strong>K</strong> play/stop • <strong>Scroll</strong> zoom
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. ADOBE PREMIERE PRO STYLE TIMELINE & VIDEO PREVIEW
// ═══════════════════════════════════════════════════════════════════════════
function AdobePremiereQuickLook({ item }: { item: FsItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [thumbStrip, setThumbStrip] = useState<string | null>(null);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [zoom, setZoom] = useState(1);

  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);
  const afmInfo = classifyFolder(item.name, item.fullPath);

  // Wheel scroll to zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => Math.max(1, Math.min(5, Math.round((prev + delta) * 10) / 10)));
  };

  useEffect(() => {
    setZoom(1);
    setHasPlaybackError(false);
    const cached = thumbnailService.getCached(item.fullPath);
    if (cached?.thumb) {
      setThumbStrip(cached.thumb);
      if (cached.duration > 0) setDuration(cached.duration);
    } else {
      thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
        if (res?.thumb) setThumbStrip(res.thumb);
        if (res?.duration) setDuration(res.duration);
      });
    }
  }, [item.fullPath]);

  // Autoplay fallback (unmuted autoplay rejection safeguard)
  useEffect(() => {
    if (videoRef.current) {
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [mediaUrl]);

  // K key to toggle play/stop
  useEffect(() => {
    const handleToggle = () => togglePlay();
    window.addEventListener('quicklook:toggle-play', handleToggle);
    return () => window.removeEventListener('quicklook:toggle-play', handleToggle);
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (!duration && videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
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

  const jogFrame = (frames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const fps = 30;
    const newTime = Math.max(0, Math.min(duration || 100, videoRef.current.currentTime + frames / fps));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const setSpeed = (spd: number) => {
    setPlaybackSpeed(spd);
    if (videoRef.current) videoRef.current.playbackRate = spd;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const captureFrame = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1920;
    canvas.height = videoRef.current.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const defaultName = `${item.name.replace(/\.[^/.]+$/, '')}_frame_${Math.floor(currentTime)}.jpg`;
      const res = await mediaService.saveSnapshot(dataUrl, defaultName);
      if (res.ok) {
        setSnapshotMsg(`Captured frame to ${res.filePath ? res.filePath.split(/[\\/]/).pop() : 'Pictures'}!`);
      } else {
        setSnapshotMsg('Frame copied to clipboard!');
      }
      setTimeout(() => setSnapshotMsg(null), 3000);
    }
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const inPercent = inPoint !== null && duration > 0 ? (inPoint / duration) * 100 : null;
  const outPercent = outPoint !== null && duration > 0 ? (outPoint / duration) * 100 : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c14] text-white">
      {/* ── Video Monitor Area with Scroll-To-Zoom ── */}
      <div
        onWheel={handleWheel}
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden min-h-0 select-none"
      >
        {hasPlaybackError ? (
          <div className="relative flex flex-col items-center justify-center w-full h-full p-4">
            {thumbStrip ? (
              <img
                src={thumbStrip}
                alt={item.name}
                className="max-h-full max-w-full object-contain filter brightness-75 rounded"
              />
            ) : (
              <Film className="w-16 h-16 text-purple-400/40 mb-3" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-6 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30 mb-2">
                Specialized Codec / High-Bitrate Video
              </span>
              <p className="text-sm font-semibold text-white mb-1">{item.name}</p>
              <p className="text-xs text-gray-300 max-w-md mb-4">
                This format or codec requires hardware-accelerated rendering in the dedicated player window.
              </p>
              <button
                onClick={() => mediaService.openSeparatePlayer(item.fullPath)}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Separate Player Window</span>
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={mediaUrl}
            autoPlay
            loop
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onError={() => setHasPlaybackError(true)}
            onLoadedMetadata={() => {
              if (videoRef.current) setDuration(videoRef.current.duration);
            }}
            style={{
              transform: `scale(${zoom})`,
              transition: 'transform 0.1s ease-out'
            }}
            className="max-h-full max-w-full object-contain"
            onClick={togglePlay}
          />
        )}

        {/* Zoom badge when zoomed */}
        {zoom > 1 && (
          <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-md text-sky-300 font-mono text-xs flex items-center gap-2 border border-sky-500/30 z-20">
            <span>Zoom: {zoom}x</span>
            <button
              onClick={() => setZoom(1)}
              className="text-[10px] text-gray-300 hover:text-white underline ml-1"
            >
              Reset
            </button>
          </div>
        )}

        {/* Top Video Overlay: SMPTE Timecode & Production Meta */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-md text-amber-300 font-mono text-xs font-bold border border-amber-400/40 shadow">
              {toSMPTETimecode(currentTime)}
            </span>
            <span className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-gray-300 font-mono border border-white/10">
              30.00 fps
            </span>
            {afmInfo.type !== 'generic' && (
              <span className="bg-indigo-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow border border-white/20">
                {afmInfo.type === 'slot_item_a' ? 'SLOT A' : afmInfo.type === 'slot_item_b' ? 'SLOT B' : 'SESSION'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-black/75 backdrop-blur-md px-2.5 py-1 rounded text-gray-300 font-mono text-xs border border-white/10">
              DURATION: {toSMPTETimecode(duration)}
            </span>
          </div>
        </div>

        {snapshotMsg && (
          <div className="absolute bottom-4 bg-emerald-600/95 text-white text-xs px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md border border-white/20">
            {snapshotMsg}
          </div>
        )}
      </div>

      {/* ── Adobe Premiere Pro Timeline Editor Bar ── */}
      <div className="h-44 border-t border-white/15 bg-[#141624] flex flex-col p-3 select-none flex-shrink-0">
        {/* Timeline Control Strip */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            {/* Step Back 1 Frame */}
            <button
              onClick={() => jogFrame(-1)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Step Back 1 Frame (J or ←)"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-md bg-[var(--mac-accent)] hover:opacity-90 text-white shadow transition-all"
              title="Play / Pause (Space or K)"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            {/* Step Forward 1 Frame */}
            <button
              onClick={() => jogFrame(1)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Step Forward 1 Frame (L or →)"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-white/20 mx-1" />

            {/* Mark In / Out */}
            <button
              onClick={() => setInPoint(currentTime)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                inPoint !== null
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                  : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
              }`}
              title="Mark In Point (I)"
            >
              Mark In [I]
            </button>
            <button
              onClick={() => setOutPoint(currentTime)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                outPoint !== null
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                  : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
              }`}
              title="Mark Out Point (O)"
            >
              Mark Out [O]
            </button>
            {(inPoint !== null || outPoint !== null) && (
              <button
                onClick={() => {
                  setInPoint(null);
                  setOutPoint(null);
                }}
                className="text-[10px] text-gray-500 hover:text-rose-400"
              >
                Clear
              </button>
            )}

            <div className="h-4 w-px bg-white/20 mx-1" />

            {/* Snapshot Frame */}
            <button
              onClick={captureFrame}
              className="p-1.5 rounded-md hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-xs"
              title="Capture Current Frame"
            >
              <Camera className="w-4 h-4" />
              <span className="text-[10px] hidden sm:inline">Snapshot</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Shuttle */}
            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 text-[10px] font-bold">
              {[0.5, 1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Mute */}
            <button
              onClick={() => setIsMuted(p => !p)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white"
              title="Mute / Unmute"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── Timeline Tracks (V1 Video & A1 Audio with CTI Scrubber) ── */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative flex-1 bg-[#0e101a] rounded-lg border border-white/10 overflow-hidden cursor-pointer flex flex-col justify-between"
        >
          {/* Time Ruler Ticks */}
          <div className="h-4 bg-[#181a28] border-b border-white/10 flex items-center px-2 justify-between text-[8px] font-mono text-gray-400 pointer-events-none">
            <span>00:00:00:00</span>
            <span>{toSMPTETimecode(duration * 0.25)}</span>
            <span>{toSMPTETimecode(duration * 0.5)}</span>
            <span>{toSMPTETimecode(duration * 0.75)}</span>
            <span>{toSMPTETimecode(duration)}</span>
          </div>

          {/* V1 Video Track */}
          <div className="relative h-9 bg-cyan-950/20 border-b border-white/5 flex items-center px-2 overflow-hidden">
            <span className="text-[9px] font-black text-cyan-400 mr-2 flex-shrink-0 z-10">V1</span>
            {thumbStrip && (
              <div
                className="absolute inset-y-0 left-6 right-0 opacity-40 bg-repeat-x bg-contain"
                style={{ backgroundImage: `url(${thumbStrip})` }}
              />
            )}
          </div>

          {/* A1 Audio Track */}
          <div className="relative h-7 bg-emerald-950/20 flex items-center px-2 overflow-hidden">
            <span className="text-[9px] font-black text-emerald-400 mr-2 flex-shrink-0 z-10">A1</span>
            {/* Waveform Bars */}
            <div className="absolute inset-y-0 left-6 right-0 flex items-center gap-1 opacity-50 overflow-hidden">
              {Array.from({ length: 64 }).map((_, i) => {
                const height = 20 + Math.sin(i * 0.8) * 15 + Math.cos(i * 1.5) * 8;
                return (
                  <div
                    key={i}
                    style={{ height: `${height}%` }}
                    className="w-1 bg-emerald-400/80 rounded-full flex-shrink-0"
                  />
                );
              })}
            </div>
          </div>

          {/* In-to-Out Region Highlight */}
          {inPercent !== null && outPercent !== null && (
            <div
              style={{
                left: `${inPercent}%`,
                width: `${Math.max(2, outPercent - inPercent)}%`
              }}
              className="absolute inset-y-4 bg-sky-500/25 border-x-2 border-sky-400 pointer-events-none"
            />
          )}

          {/* Premiere CTI Playhead (Needle) */}
          <div
            style={{ left: `${currentPercent}%` }}
            className="absolute inset-y-0 w-0.5 bg-amber-400 z-30 pointer-events-none"
          >
            {/* Playhead Inverted Triangle Top */}
            <div className="absolute -top-0 -left-1.5 w-3.5 h-3 bg-amber-400 clip-playhead" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CAMERA RAW PHOTO PREVIEW (.CR3, .CR2, .NEF, etc.)
// ═══════════════════════════════════════════════════════════════════════════
function CameraRawQuickLook({ item }: { item: FsItem }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => Math.max(1, Math.min(5, Math.round((prev + delta) * 10) / 10)));
  };

  useEffect(() => {
    setZoom(1);
    let isCurrent = true;
    const cached = thumbnailService.getCached(item.fullPath)?.thumb;
    if (cached) {
      setThumb(cached);
      setLoading(false);
    }
    mediaService.readImageBase64(item.fullPath).then(res => {
      if (isCurrent && res.ok && res.dataUrl) {
        setThumb(res.dataUrl);
        setLoading(false);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [item.fullPath]);

  return (
    <div onWheel={handleWheel} className="flex-1 flex flex-col items-center justify-center p-4 bg-black relative overflow-hidden select-none">
      {thumb ? (
        <img
          src={thumb}
          alt={item.name}
          style={{
            transform: `scale(${zoom})`,
            transition: 'transform 0.1s ease-out'
          }}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-rose-400">
          <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-sm font-semibold">Extracting Camera RAW Embedded JPEG...</span>
        </div>
      )}
      {zoom > 1 && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md text-rose-300 font-mono text-xs flex items-center gap-2 border border-rose-500/30 z-20">
          <span>Zoom: {zoom}x</span>
          <button onClick={() => setZoom(1)} className="text-[10px] text-gray-300 hover:text-white underline ml-1">
            Reset
          </button>
        </div>
      )}
      <span className="absolute bottom-4 right-4 bg-rose-950/80 backdrop-blur-md text-rose-300 border border-rose-500/40 text-xs font-black px-2.5 py-1 rounded shadow uppercase tracking-wider">
        CAMERA RAW • {item.ext.toUpperCase()}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. STANDARD PHOTO PREVIEW (JPG, PNG, WEBP, GIF, SVG)
// ═══════════════════════════════════════════════════════════════════════════
function StandardPhotoQuickLook({ item }: { item: FsItem }) {
  const [fallback, setFallback] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);

  useEffect(() => {
    setZoom(1);
    setFallback(null);
  }, [item.fullPath]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => Math.max(1, Math.min(5, Math.round((prev + delta) * 10) / 10)));
  };

  return (
    <div onWheel={handleWheel} className="flex-1 flex items-center justify-center p-4 bg-black relative overflow-hidden select-none">
      <img
        src={fallback || mediaUrl}
        alt={item.name}
        onError={() => {
          mediaService.readImageBase64(item.fullPath).then(res => {
            if (res.ok && res.dataUrl) setFallback(res.dataUrl);
          });
        }}
        style={{
          transform: `scale(${zoom})`,
          transition: 'transform 0.1s ease-out'
        }}
        className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
      />
      {zoom > 1 && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md text-sky-300 font-mono text-xs flex items-center gap-2 border border-sky-500/30 z-20">
          <span>Zoom: {zoom}x</span>
          <button onClick={() => setZoom(1)} className="text-[10px] text-gray-300 hover:text-white underline ml-1">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. AUDIO PLAYER PREVIEW (.MP3, .WAV, .FLAC, .M4A)
// ═══════════════════════════════════════════════════════════════════════════
function AudioQuickLook({ item }: { item: FsItem }) {
  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleToggle = () => {
      if (!audioRef.current) return;
      if (audioRef.current.paused) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    };
    window.addEventListener('quicklook:toggle-play', handleToggle);
    return () => window.removeEventListener('quicklook:toggle-play', handleToggle);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0e101a]">
      <div className="w-32 h-32 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl mb-6">
        <Music className="w-16 h-16 text-white" />
      </div>

      <h3 className="text-base font-bold text-white mb-1 truncate max-w-md">{item.name}</h3>
      <p className="text-xs text-indigo-300 font-mono mb-6 uppercase">{item.ext} Audio</p>

      {/* Audio Waveform Equalizer Animation */}
      <div className="flex items-center gap-1.5 h-12 mb-6">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              animation: `bounce 1.${(i % 5) + 2}s infinite ease-in-out`,
              height: `${25 + ((i * 7) % 65)}%`
            }}
            className="w-1.5 bg-indigo-500 rounded-full"
          />
        ))}
      </div>

      <audio ref={audioRef} src={mediaUrl} controls autoPlay className="w-full max-w-md shadow-lg" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PDF DOCUMENT PREVIEW
// ═══════════════════════════════════════════════════════════════════════════
function PdfQuickLook({ item }: { item: FsItem }) {
  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);

  return (
    <div className="flex-1 w-full h-full bg-neutral-900">
      <iframe
        src={mediaUrl}
        title={item.name}
        className="w-full h-full border-0"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. CSV / TSV DATA TABLE PREVIEW
// ═══════════════════════════════════════════════════════════════════════════
function CsvQuickLook({ item }: { item: FsItem }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mediaService.readTextFile(item.fullPath, 256 * 1024).then(res => {
      if (res.ok && res.content) {
        const delimiter = item.ext.toLowerCase() === 'tsv' ? '\t' : ',';
        const lines = res.content.split(/\r?\n/).filter(l => l.trim().length > 0);
        const parsed = lines.slice(0, 100).map(line => line.split(delimiter));
        setRows(parsed);
      }
      setLoading(false);
    });
  }, [item.fullPath, item.ext]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <Table className="w-8 h-8 animate-spin mr-2" /> Loading spreadsheet data...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Empty or unreadable table
      </div>
    );
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return (
    <div className="flex-1 overflow-auto bg-[#10121d] text-xs font-mono p-4">
      <table className="w-full border-collapse border border-white/10">
        <thead>
          <tr className="bg-[#1a1d2e] text-indigo-300">
            {headers.map((h, i) => (
              <th key={i} className="border border-white/10 px-3 py-2 text-left font-semibold truncate">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/5 border-b border-white/5">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="border border-white/5 px-3 py-1.5 text-gray-300 truncate max-w-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. CODE & TEXT DOCUMENT VIEWER (TS, JS, PY, JSON, MD, TXT, BAT, ETC.)
// ═══════════════════════════════════════════════════════════════════════════
function CodeTextQuickLook({ item }: { item: FsItem }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    mediaService.readTextFile(item.fullPath).then(res => {
      if (res.ok && res.content !== undefined) {
        setContent(res.content);
      } else {
        setContent('Unable to read text preview.');
      }
      setLoading(false);
    });
  }, [item.fullPath]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = useMemo(() => content.split('\n'), [content]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1017] text-gray-200">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161a24] text-xs">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-gray-300">{item.name}</span>
          <span className="text-[10px] text-gray-500 font-mono">({lines.length} lines)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">Loading code...</div>
        ) : (
          <div className="flex">
            {/* Line numbers */}
            <div className="select-none text-gray-600 text-right pr-4 border-r border-white/5 font-mono">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Code content */}
            <pre className="pl-4 whitespace-pre overflow-x-auto text-gray-200 flex-1 font-mono">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. EXECUTABLE & APPLICATION INSTALLER CARD (.EXE, .MSI, .BAT)
// ═══════════════════════════════════════════════════════════════════════════
function AppQuickLook({ item }: { item: FsItem }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0f111c] text-center">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-2xl mb-4">
        <Terminal className="w-12 h-12 text-white" />
      </div>

      <h2 className="text-lg font-bold text-white mb-1 truncate max-w-md">{item.name}</h2>
      <p className="text-xs text-sky-400 font-mono uppercase mb-6">{item.ext} Executable Application</p>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm w-full text-xs text-left space-y-2 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-400">File Size:</span>
          <span className="font-mono text-white">{formatBytes(item.size)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Target Architecture:</span>
          <span className="font-semibold text-white">x64 / Windows Native</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Modified:</span>
          <span className="text-white">{formatDate(item.mtime)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => mediaService.openExternal(item.fullPath)}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Launch Application</span>
        </button>
        <button
          onClick={() => mediaService.openInExplorer(item.fullPath)}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
        >
          Show in Explorer
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. ARCHIVE INSPECTOR CARD (.ZIP, .RAR, .7Z)
// ═══════════════════════════════════════════════════════════════════════════
function ArchiveQuickLook({ item }: { item: FsItem }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0f111c] text-center">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-2xl mb-4">
        <Archive className="w-12 h-12 text-white" />
      </div>

      <h2 className="text-lg font-bold text-white mb-1 truncate max-w-md">{item.name}</h2>
      <p className="text-xs text-amber-400 font-mono uppercase mb-6">{item.ext} Compressed Archive</p>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm w-full text-xs text-left space-y-2 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-400">Archive Size:</span>
          <span className="font-mono text-white">{formatBytes(item.size)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Modified:</span>
          <span className="text-white">{formatDate(item.mtime)}</span>
        </div>
      </div>

      <button
        onClick={() => mediaService.openInExplorer(item.fullPath)}
        className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all"
      >
        Open Archive in Windows Explorer
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. GENERIC UNIVERSAL FILE CONTENT VIEWER (ANY FILE CONTENT)
// ═══════════════════════════════════════════════════════════════════════════
function GenericFileQuickLook({ item }: { item: FsItem }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    mediaService.readTextFile(item.fullPath, 512 * 1024).then(res => {
      if (isCurrent) {
        if (res.ok && res.content !== undefined && res.content.trim().length > 0) {
          setContent(res.content);
        } else {
          setContent(null);
        }
        setLoading(false);
      }
    }).catch(() => {
      if (isCurrent) {
        setContent(null);
        setLoading(false);
      }
    });
    return () => { isCurrent = false; };
  }, [item.fullPath]);

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = useMemo(() => (content ? content.split('\n') : []), [content]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0c14] text-gray-400">
        <Sparkles className="w-8 h-8 animate-pulse text-indigo-400 mb-2" />
        <span className="text-xs">Reading file contents...</span>
      </div>
    );
  }

  // If text/code content is readable, display full content with line numbers!
  if (content !== null) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0d1017] text-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161a24] text-xs">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-gray-300">{item.name}</span>
            <span className="text-[10px] text-gray-500 font-mono">({lines.length} lines)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => mediaService.openExternal(item.fullPath)}
              className="px-2.5 py-1 rounded bg-[var(--mac-accent)] text-white font-medium text-[11px]"
            >
              Open File
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-[#0a0c14] text-gray-300">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-white/[0.04]">
                  <td className="w-10 pr-3 select-none text-right text-gray-600 font-mono text-[11px]">
                    {i + 1}
                  </td>
                  <td className="whitespace-pre-wrap break-all text-gray-200 pl-2">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Binary or opaque file inspection
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0f111c] text-center">
      <div className="mb-4">
        <MacDocumentIcon size={96} ext={item.ext} />
      </div>

      <h2 className="text-base font-bold text-white mb-1 truncate max-w-md" title={item.name}>
        {item.name}
      </h2>
      <p className="text-xs text-indigo-400 font-mono uppercase mb-6">{item.ext} Document</p>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm w-full text-xs text-left space-y-2 mb-6 font-mono">
        <div className="flex justify-between">
          <span className="text-gray-400">Size:</span>
          <span className="text-white">{formatBytes(item.size ?? 0)} ({(item.size ?? 0).toLocaleString()} bytes)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Location:</span>
          <span className="text-gray-300 truncate max-w-[200px]" title={item.fullPath}>
            {item.fullPath}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Modified:</span>
          <span className="text-white">{formatDate(item.mtime)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => mediaService.openExternal(item.fullPath)}
          className="px-5 py-2 rounded-xl bg-[var(--mac-accent)] hover:opacity-90 text-white font-bold text-xs shadow-lg transition-all"
        >
          Open with Default Application
        </button>
        <button
          onClick={() => mediaService.openInExplorer(item.fullPath)}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
        >
          Show in Explorer
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. FOLDER / DIRECTORY CONTENT PREVIEW
// ═══════════════════════════════════════════════════════════════════════════
function FolderQuickLook({
  item,
  onClose,
  onNavigate
}: {
  item: FsItem;
  onClose: () => void;
  onNavigate?: (item: FsItem) => void;
}) {
  const [children, setChildren] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'files' | 'subfolders'>('all');

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    mediaService.listDir(item.fullPath).then(res => {
      if (isCurrent) {
        setChildren(res || []);
        setLoading(false);
      }
    }).catch(() => {
      if (isCurrent) setLoading(false);
    });
    return () => { isCurrent = false; };
  }, [item.fullPath]);

  // Separate subfolders and files strictly belonging to this one folder
  const subfolders = useMemo(() => children.filter(c => c.isDir), [children]);
  const files = useMemo(() => children.filter(c => !c.isDir), [children]);

  // Total size calculated from files in this folder
  const totalFilesSize = useMemo(() => files.reduce((acc, f) => acc + (f.size || 0), 0), [files]);

  // Tab key cycles through folder filters
  useEffect(() => {
    const handleFolderTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setFilterMode(prev => {
          if (prev === 'all') return 'files';
          if (prev === 'files') return 'subfolders';
          return 'all';
        });
      }
    };
    window.addEventListener('keydown', handleFolderTab);
    return () => window.removeEventListener('keydown', handleFolderTab);
  }, []);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.fullPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedItems = useMemo(() => {
    if (filterMode === 'files') return files;
    if (filterMode === 'subfolders') return subfolders;
    return children;
  }, [filterMode, children, files, subfolders]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1017] text-white overflow-hidden">
      {/* Top Header styled like GenericFileQuickLook */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10 bg-[#161a24] text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          <MacFolderIcon size={20} />
          <span className="font-semibold text-gray-200">{item.name}</span>
          <span className="text-[10px] text-gray-400 font-mono">
            ({subfolders.length} subfolders, {files.length} files)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPath}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy Path'}</span>
          </button>
          <button
            onClick={() => {
              onClose();
              mediaService.openInExplorer(item.fullPath);
            }}
            className="px-2.5 py-1 rounded bg-[var(--mac-accent)] text-white font-medium text-[11px] flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open in Explorer</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto flex flex-col p-5 gap-4">
        {/* Folder Overview Info Card (styled like GenericFileQuickLook) */}
        <div className="bg-[#121420] border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-center sm:items-start gap-5 flex-shrink-0">
          <div className="flex-shrink-0 flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10">
            <MacFolderIcon size={56} />
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-base font-bold text-white truncate" title={item.name}>
              {item.name}
            </h2>
            <p className="text-xs text-emerald-400 font-mono uppercase mb-3">Folder / Directory</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Direct Size</span>
                <span className="text-white font-semibold">{formatBytes(totalFilesSize)}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Subfolders</span>
                <span className="text-sky-400 font-semibold">{subfolders.length} Subfolders</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Files</span>
                <span className="text-purple-400 font-semibold">{files.length} Files</span>
              </div>
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Modified</span>
                <span className="text-gray-300">{formatDate(item.mtime)}</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-gray-400 font-mono truncate" title={item.fullPath}>
              <span className="text-gray-500">Path: </span>{item.fullPath}
            </div>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              All Items ({children.length})
            </button>
            <button
              onClick={() => setFilterMode('files')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterMode === 'files'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Files ({files.length})
            </button>
            <button
              onClick={() => setFilterMode('subfolders')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterMode === 'subfolders'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Subfolders ({subfolders.length})
            </button>
          </div>
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            Direct items of {item.name}
          </span>
        </div>

        {/* Items Grid */}
        <div className="flex-1 min-h-[140px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 text-xs">
              <Sparkles className="w-6 h-6 animate-pulse text-indigo-400 mb-2" />
              <span>Loading folder contents...</span>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500 text-xs">
              <span>No {filterMode === 'subfolders' ? 'subfolders' : filterMode === 'files' ? 'files' : 'items'} in this folder</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {displayedItems.map(child => (
                <div
                  key={child.fullPath}
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate(child);
                    }
                  }}
                  onDoubleClick={() => {
                    if (child.isDir) {
                      if (onNavigate) onNavigate(child);
                    } else {
                      mediaService.openSeparatePlayer(child.fullPath);
                    }
                  }}
                  className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.09] hover:border-white/20 transition-all cursor-pointer"
                  title={`${child.name} (${child.isDir ? 'Subfolder' : formatBytes(child.size ?? 0)})`}
                >
                  <div className="flex-shrink-0">
                    {child.isDir ? (
                      <MacFolderIcon size={24} />
                    ) : (
                      <MacDocumentIcon size={24} ext={child.ext} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-gray-200 block truncate group-hover:text-white font-medium">
                      {child.name}
                    </span>
                    <span className="text-[10.5px] text-gray-400 font-mono block mt-0.5">
                      {child.isDir
                        ? (child.childCount !== undefined ? `${child.childCount} items` : 'Subfolder')
                        : formatBytes(child.size ?? 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}