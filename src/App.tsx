import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Folder,
  File,
  HardDrive,
  ChevronRight,
  ChevronLeft,
  Home,
  Search,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  List,
  Eye,
  X,
  Play,
  Pause,
  RotateCw,
  Camera,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Clock,
  Film,
  Image as ImageIcon,
  Sparkles,
  Info,
  Download,
  Check,
  Compass
} from 'lucide-react';

const api = (window as any).mediaViewerAPI;

interface FsItem {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
  ext: string;
  fullPath: string;
}

const PHOTO_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif',
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw'
]);

const VIDEO_EXTS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts', 'wmv', 'flv', 'm2ts', 'mpg', 'mpeg'
]);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function formatDate(mtime: number): string {
  if (!mtime) return '—';
  const d = new Date(mtime);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimelapse(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return '';
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

// Global cache for video thumbnail frames & durations
const videoThumbCache = new Map<string, { thumb: string; duration: number }>();

// ── Visual Thumbnail Card ───────────────────────────────────────
function ThumbnailCard({
  item,
  onClick,
  onOpen
}: {
  item: FsItem;
  onClick: () => void;
  onOpen: () => void;
}) {
  const isPhoto = PHOTO_EXTS.has(item.ext);
  const isVideo = VIDEO_EXTS.has(item.ext);
  const [thumb, setThumb] = useState<string | null>(() => videoThumbCache.get(item.fullPath)?.thumb || null);
  const [duration, setDuration] = useState<number>(() => videoThumbCache.get(item.fullPath)?.duration || 0);

  useEffect(() => {
    if (!isVideo || thumb) return;
    let isMounted = true;
    const v = document.createElement('video');
    v.src = api?.toLocalResourceUrl ? api.toLocalResourceUrl(item.fullPath) : item.fullPath;
    v.crossOrigin = 'anonymous';
    v.preload = 'metadata';
    v.muted = true;

    v.onloadedmetadata = () => {
      if (!isMounted) return;
      const dur = v.duration || 0;
      setDuration(dur);
      // Seek to 1s or 10%
      const targetTime = Math.min(Math.max(0.5, dur * 0.1), dur > 1 ? dur - 0.2 : 0);
      v.currentTime = targetTime;
    };

    v.onseeked = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        const w = v.videoWidth || 320;
        const h = v.videoHeight || 180;
        canvas.width = Math.min(320, w);
        canvas.height = Math.round((canvas.width / w) * h);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setThumb(dataUrl);
          videoThumbCache.set(item.fullPath, { thumb: dataUrl, duration: v.duration || 0 });
        }
      } catch {
        // fallback
      } finally {
        v.src = '';
      }
    };

    return () => {
      isMounted = false;
      v.src = '';
    };
  }, [item.fullPath, isVideo, thumb]);

  const photoUrl = isPhoto ? (api?.toLocalResourceUrl ? api.toLocalResourceUrl(item.fullPath) : item.fullPath) : null;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onOpen}
      className="group relative flex flex-col bg-[#141620] hover:bg-[#1a1e2d] border border-white/10 hover:border-indigo-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-lg hover:shadow-indigo-500/15"
    >
      {/* Thumbnail Aspect Box */}
      <div className="relative aspect-video w-full bg-black/60 flex items-center justify-center overflow-hidden">
        {isPhoto ? (
          <img
            src={photoUrl || ''}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : isVideo ? (
          thumb ? (
            <img
              src={thumb}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-indigo-400">
              <Film className="w-8 h-8 opacity-60 animate-pulse" />
            </div>
          )
        ) : item.isDir ? (
          <Folder className="w-12 h-12 text-amber-400/80 group-hover:scale-110 transition-transform" />
        ) : (
          <File className="w-10 h-10 text-gray-400 group-hover:scale-110 transition-transform" />
        )}

        {/* Video Duration / Timelapse Badge (e.g. 10s) */}
        {isVideo && duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md text-amber-300 border border-amber-400/40 text-[11px] font-bold px-1.5 py-0.5 rounded shadow-xl flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatTimelapse(duration)}
          </span>
        )}

        {/* Format Badge */}
        {!item.isDir && item.ext && (
          <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-gray-300 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-white/10">
            {item.ext}
          </span>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl hover:scale-110 transition-all"
            title="Inspect & Zoom"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta Footer */}
      <div className="p-2.5 flex flex-col justify-between flex-1">
        <span className="text-xs font-semibold text-gray-200 truncate" title={item.name}>
          {item.name}
        </span>
        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
          <span>{item.isDir ? 'Folder' : formatBytes(item.size)}</span>
          <span>{item.isDir ? 'DIR' : item.ext.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Interactive High-Definition Media Viewer with Frame Zoom ────
function FullscreenViewer({
  item,
  items,
  onClose,
  onNavigate
}: {
  item: FsItem;
  items: FsItem[];
  onClose: () => void;
  onNavigate: (target: FsItem) => void;
}) {
  const isVideo = VIDEO_EXTS.has(item.ext);
  const isPhoto = PHOTO_EXTS.has(item.ext);
  const mediaUrl = api?.toLocalResourceUrl ? api.toLocalResourceUrl(item.fullPath) : item.fullPath;

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  // Video playback state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoop, setIsLoop] = useState(false);

  // Photo state
  const [rotate, setRotate] = useState(0);
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);

  // Sibling media list
  const mediaList = useMemo(
    () => items.filter(f => !f.isDir && (PHOTO_EXTS.has(f.ext) || VIDEO_EXTS.has(f.ext))),
    [items]
  );
  const currentIndex = mediaList.findIndex(f => f.fullPath === item.fullPath);

  const goPrev = () => {
    if (currentIndex > 0) onNavigate(mediaList[currentIndex - 1]);
  };
  const goNext = () => {
    if (currentIndex < mediaList.length - 1) onNavigate(mediaList[currentIndex + 1]);
  };

  // Reset zoom & pan when item changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotate(0);
    setIsPlaying(true);
  }, [item.fullPath]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.18 : 0.18;
    setZoom(z => {
      const nextZoom = Math.min(Math.max(1, z + delta * z), 8);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return nextZoom;
    });
  };

  // Pan zoomed frame
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pan.x, oy: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    setPan({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStart.current = null;
  };

  // Precision 1-Frame Stepping
  const stepFrame = (frames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const fps = 30;
    const newTime = Math.max(0, Math.min(duration || 99999, videoRef.current.currentTime + frames / fps));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Native High-Res Frame Snapshot
  const captureFrameSnapshot = async () => {
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
        if (api?.saveSnapshot) {
          const res = await api.saveSnapshot(dataUrl, defaultName);
          if (res.ok) {
            setSnapshotFeedback('Snapshot Saved!');
          }
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
  };

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
        setZoom(z => Math.min(8, z + 0.25));
      } else if (e.key === '-') {
        setZoom(z => {
          const nz = Math.max(1, z - 0.25);
          if (nz === 1) setPan({ x: 0, y: 0 });
          return nz;
        });
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, isVideo, duration, currentIndex, mediaList]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col select-none"
      onClick={onClose}
    >
      {/* Top Studio Bar */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-[#11131c]/90 border-b border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white max-w-lg truncate">{item.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
            {formatBytes(item.size)}
          </span>
          {isVideo && duration > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5 shadow-md">
              <Clock className="w-3.5 h-3.5" />
              <span>Timelapse: {formatTimelapse(duration)}</span>
            </span>
          )}
        </div>

        {/* Center Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() =>
                setZoom(z => {
                  const nz = Math.max(1, z - 0.25);
                  if (nz === 1) setPan({ x: 0, y: 0 });
                  return nz;
                })
              }
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-indigo-300 w-14 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(8, z + 0.25))}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {zoom > 1 && (
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="text-xs font-bold text-amber-400 px-2 py-1 hover:bg-white/10 rounded-lg"
                title="Reset Zoom to Fit"
              >
                Fit / 100%
              </button>
            )}
          </div>

          {/* Photo Rotation */}
          {isPhoto && (
            <button
              onClick={() => setRotate(r => (r + 90) % 360)}
              className="p-2 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white border border-white/10"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {/* Video Snapshot Button */}
          {isVideo && (
            <button
              onClick={captureFrameSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-xl hover:scale-105 transition-all"
              title="Capture & Save High-Res Frame Snapshot"
            >
              <Camera className="w-4 h-4" />
              <span>Snapshot</span>
            </button>
          )}

          {snapshotFeedback && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              {snapshotFeedback}
            </span>
          )}

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white ml-2"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          <img
            src={mediaUrl}
            alt={item.name}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out'
            }}
            className="max-h-[85vh] max-w-[90vw] object-contain select-none shadow-2xl rounded"
            draggable={false}
          />
        ) : isVideo ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              loop={isLoop}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transition: isDragging ? 'none' : 'transform 0.12s ease-out'
              }}
              className="max-h-[84vh] max-w-[90vw] object-contain select-none shadow-2xl rounded-xl"
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        ) : null}
      </div>

      {/* Video Interactive Controls Bar */}
      {isVideo && (
        <div
          className="px-6 py-3 bg-[#11131c]/95 border-t border-white/10 flex items-center gap-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Play/Pause */}
          <button
            onClick={() => {
              if (isPlaying) {
                videoRef.current?.pause();
                setIsPlaying(false);
              } else {
                videoRef.current?.play();
                setIsPlaying(true);
              }
            }}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Time indicator */}
          <span className="text-xs font-mono text-gray-300 w-28">
            {formatTimelapse(currentTime)} / {formatTimelapse(duration)}
          </span>

          {/* Frame-by-frame Stepping Buttons */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => stepFrame(-1)}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded font-semibold"
              title="Step -1 Frame Back (Left arrow)"
            >
              ⏮ -1f
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded font-semibold"
              title="Step +1 Frame Forward (Right arrow)"
            >
              +1f ⏭
            </button>
          </div>

          {/* Seek Track */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={e => {
              const val = parseFloat(e.target.value);
              if (videoRef.current) {
                videoRef.current.currentTime = val;
                setCurrentTime(val);
              }
            }}
            className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-white/20 rounded-lg"
          />

          {/* Volume */}
          <button
            onClick={() => {
              if (isMuted) {
                setIsMuted(false);
                if (videoRef.current) videoRef.current.muted = false;
              } else {
                setIsMuted(true);
                if (videoRef.current) videoRef.current.muted = true;
              }
            }}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-300"
            title="Toggle Mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              setIsMuted(v === 0);
              if (videoRef.current) {
                videoRef.current.volume = v;
                videoRef.current.muted = v === 0;
              }
            }}
            className="w-20 accent-indigo-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
          />

          {/* Speed Select */}
          <select
            value={playbackSpeed}
            onChange={e => {
              const s = parseFloat(e.target.value);
              setPlaybackSpeed(s);
              if (videoRef.current) videoRef.current.playbackRate = s;
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
          >
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
              <option key={s} value={s} className="bg-[#141620]">
                {s}×
              </option>
            ))}
          </select>

          {/* Duration Badge */}
          <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            ⏱ {formatTimelapse(duration)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Child App Component ──────────────────────────────────
export default function App() {
  const [drives, setDrives] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'video' | 'photo' | 'timelapse'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activeItem, setActiveItem] = useState<FsItem | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Initialize drives and handle CLI open target
  useEffect(() => {
    api?.getDrives?.().then((d: string[]) => {
      setDrives(d);
      if (d && d.length > 0 && !currentPath) {
        navigate(d[0]);
      }
    });

    api?.getInitialFile?.().then((target: string | null) => {
      if (target) handleOpenTarget(target);
    });

    const unsubscribe = api?.onOpenTarget?.((target: string) => {
      handleOpenTarget(target);
    });

    return () => unsubscribe?.();
  }, []);

  const handleOpenTarget = async (target: string) => {
    const isFile = PHOTO_EXTS.has((target.split('.').pop() || '').toLowerCase()) ||
                   VIDEO_EXTS.has((target.split('.').pop() || '').toLowerCase());
    if (isFile) {
      const parentDir = target.substring(0, target.lastIndexOf('\\')) || target.substring(0, target.lastIndexOf('/'));
      if (parentDir) {
        await navigate(parentDir);
        const ext = (target.split('.').pop() || '').toLowerCase();
        setActiveItem({
          name: target.split(/[\\/]/).pop() || '',
          isDir: false,
          size: 0,
          mtime: Date.now(),
          ext,
          fullPath: target
        });
      }
    } else {
      navigate(target);
    }
  };

  const navigate = useCallback(
    async (dirPath: string) => {
      setLoading(true);
      setSearch('');
      const results = (await api?.listDir?.(dirPath)) || [];
      setItems(results);
      setCurrentPath(dirPath);
      setSelectedPath(null);
      setHistory(prev => {
        const next = [...prev.slice(0, historyIdx + 1), dirPath];
        setHistoryIdx(next.length - 1);
        return next;
      });
      setLoading(false);
    },
    [historyIdx]
  );

  const goBack = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(h => h - 1);
      loadPath(prev);
    }
  };

  const goForward = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(h => h + 1);
      loadPath(next);
    }
  };

  const loadPath = async (p: string) => {
    setLoading(true);
    setSearch('');
    const results = (await api?.listDir?.(p)) || [];
    setItems(results);
    setCurrentPath(p);
    setSelectedPath(null);
    setLoading(false);
  };

  const chooseFolder = async () => {
    const folder = await api?.selectFolder?.();
    if (folder) navigate(folder);
  };

  const breadcrumbs = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);

  const filteredItems = useMemo(() => {
    let list = items;
    if (search.trim()) {
      list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (filterCategory === 'photo') {
      list = list.filter(i => i.isDir || PHOTO_EXTS.has(i.ext));
    } else if (filterCategory === 'video') {
      list = list.filter(i => i.isDir || VIDEO_EXTS.has(i.ext));
    } else if (filterCategory === 'timelapse') {
      list = list.filter(i => {
        if (i.isDir) return true;
        if (!VIDEO_EXTS.has(i.ext)) return false;
        const cached = videoThumbCache.get(i.fullPath);
        return cached ? cached.duration <= 60 : true;
      });
    }
    return list;
  }, [items, search, filterCategory]);

  const handleItemOpen = (item: FsItem) => {
    if (item.isDir) {
      navigate(item.fullPath);
    } else if (PHOTO_EXTS.has(item.ext) || VIDEO_EXTS.has(item.ext)) {
      setActiveItem(item);
    } else {
      api?.openExternal?.(item.fullPath);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0c0d12] text-gray-200 select-none">
      {/* Top Studio Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-[#12141c]">
        {/* App Logo & Branding */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-sm shadow-md">
            MV
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white tracking-wide leading-tight">MediaView Studio</span>
            <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Anything Suite</span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            disabled={historyIdx <= 0}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goForward}
            disabled={historyIdx >= history.length - 1}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => loadPath(currentPath)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto text-sm px-2">
          <button onClick={() => setCurrentPath('')} className="text-gray-400 hover:text-white">
            <Home className="w-3.5 h-3.5" />
          </button>
          {breadcrumbs.map((seg, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <button
                onClick={() => {
                  const p = breadcrumbs.slice(0, idx + 1).join('/') + '/';
                  navigate(p);
                }}
                className="hover:text-white text-gray-300 font-medium truncate max-w-[150px]"
              >
                {seg}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-xs font-semibold">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg transition-all ${filterCategory === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterCategory('photo')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${filterCategory === 'photo' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            <ImageIcon className="w-3 h-3" /> Photos
          </button>
          <button
            onClick={() => setFilterCategory('video')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${filterCategory === 'video' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            <Film className="w-3 h-3" /> Videos
          </button>
          <button
            onClick={() => setFilterCategory('timelapse')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${filterCategory === 'timelapse' ? 'bg-amber-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            title="Timelapses & Short Videos (≤ 60s)"
          >
            <Clock className="w-3 h-3" /> Timelapses
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search media..."
            className="bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1 text-sm focus:outline-none focus:border-indigo-500 text-gray-200 w-44"
          />
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            title="Grid / Thumbnails"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            title="List / Details"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Open Folder Button */}
        <button
          onClick={chooseFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all hover:scale-105"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open Folder</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left Drives & Folders Sidebar */}
        <div className="w-60 flex-shrink-0 border-r border-white/10 bg-[#10121a] overflow-y-auto flex flex-col p-2">
          <div className="px-2 pt-2 pb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Drives
          </div>
          {drives.map(d => (
            <button
              key={d}
              onClick={() => navigate(d)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${currentPath.startsWith(d) ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <span>{d}</span>
            </button>
          ))}

          <div className="mt-4 px-2 pb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Subfolders
          </div>
          {items
            .filter(i => i.isDir)
            .map(i => (
              <button
                key={i.fullPath}
                onClick={() => navigate(i.fullPath)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all truncate"
                title={i.name}
              >
                <Folder className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
                <span className="truncate">{i.name}</span>
              </button>
            ))}
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto p-4">
          {!currentPath ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Film className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-base font-semibold">Select a drive or open a folder to browse media</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading media assets...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">No media files match your search / filter in this folder.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {filteredItems.map(item => (
                <ThumbnailCard
                  key={item.fullPath}
                  item={item}
                  onClick={() => setSelectedPath(item.fullPath)}
                  onOpen={() => handleItemOpen(item)}
                />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase border-b border-white/10">
                  <th className="text-left py-2 px-3 font-semibold">Name</th>
                  <th className="text-left py-2 px-3 font-semibold w-24">Type</th>
                  <th className="text-right py-2 px-3 font-semibold w-28">Size</th>
                  <th className="text-right py-2 px-3 font-semibold w-48">Date Modified</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr
                    key={item.fullPath}
                    onClick={() => setSelectedPath(item.fullPath)}
                    onDoubleClick={() => handleItemOpen(item)}
                    className={`cursor-pointer hover:bg-white/5 rounded-lg transition-colors ${selectedPath === item.fullPath ? 'bg-indigo-500/15 text-indigo-200' : ''}`}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        {item.isDir ? (
                          <Folder className="w-4 h-4 text-amber-400" />
                        ) : PHOTO_EXTS.has(item.ext) ? (
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                        ) : VIDEO_EXTS.has(item.ext) ? (
                          <Film className="w-4 h-4 text-purple-400" />
                        ) : (
                          <File className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="truncate max-w-lg font-medium">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs uppercase text-gray-400">
                      {item.isDir ? 'Folder' : item.ext}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums">
                      {item.isDir ? '—' : formatBytes(item.size)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums">
                      {formatDate(item.mtime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-[#12141c] text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>{filteredItems.length} items shown</span>
          <span>{items.filter(i => VIDEO_EXTS.has(i.ext)).length} videos</span>
          <span>{items.filter(i => PHOTO_EXTS.has(i.ext)).length} photos</span>
        </div>
        {selectedPath && <span className="truncate max-w-xl text-gray-400 font-mono text-[11px]">{selectedPath}</span>}
      </div>

      {/* Fullscreen HD Media Viewer Modal */}
      {activeItem && (
        <FullscreenViewer
          item={activeItem}
          items={filteredItems}
          onClose={() => setActiveItem(null)}
          onNavigate={target => setActiveItem(target)}
        />
      )}
    </div>
  );
}
