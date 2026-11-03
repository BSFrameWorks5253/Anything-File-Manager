import React, { useRef, useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Clock,
  Film,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Camera
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  isRawExtension,
  formatTimelapse,
  formatPlaybackTime
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { useVideoFrameZoom } from '../../hooks';

interface ExplorerGalleryProps {
  items: FsItem[];
  selectedItem: FsItem | null;
  onSelectItem: (item: FsItem) => void;
  onOpenViewer: (item: FsItem) => void;
}

export const ExplorerGallery: React.FC<ExplorerGalleryProps> = ({
  items,
  selectedItem,
  onSelectItem,
  onOpenViewer
}) => {
  const mediaItems = items.filter(i => isPhotoExtension(i.ext) || isVideoExtension(i.ext));
  const activeItem = selectedItem || mediaItems[0] || null;
  const currentIdx = mediaItems.findIndex(i => i.fullPath === activeItem?.fullPath);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  const {
    zoom,
    pan,
    isDragging,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom,
    setZoom
  } = useVideoFrameZoom();

  // Reset states on active item change
  useEffect(() => {
    resetZoom();
    setIsPlaying(true);
    setCurrentTime(0);
  }, [activeItem?.fullPath, resetZoom]);

  const goPrev = () => {
    if (currentIdx > 0) onSelectItem(mediaItems[currentIdx - 1]);
  };

  const goNext = () => {
    if (currentIdx < mediaItems.length - 1) onSelectItem(mediaItems[currentIdx + 1]);
  };

  const isPhoto = activeItem ? isPhotoExtension(activeItem.ext) : false;
  const isVideo = activeItem ? isVideoExtension(activeItem.ext) : false;
  const isRaw = activeItem ? isRawExtension(activeItem.ext) : false;
  const mediaUrl = activeItem ? mediaService.toLocalResourceUrl(activeItem.fullPath) : '';

  const [rawPreviewUrl, setRawPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!activeItem || !isRaw) {
      setRawPreviewUrl(null);
      return;
    }
    const cached = thumbnailService.getCached(activeItem.fullPath)?.thumb;
    if (cached) setRawPreviewUrl(cached);

    let isCurrent = true;
    mediaService.readImageBase64(activeItem.fullPath).then(res => {
      if (isCurrent && res.ok && res.dataUrl) {
        setRawPreviewUrl(res.dataUrl);
      }
    });
    return () => { isCurrent = false; };
  }, [activeItem?.fullPath, isRaw]);

  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const res = await mediaService.saveSnapshot(dataUrl, `gallery_frame_${Date.now()}.jpg`);
      if (res.ok) {
        setSnapshotMsg('Snapshot saved!');
        setTimeout(() => setSnapshotMsg(null), 2500);
      }
    } catch {}
  };

  if (!activeItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 select-none">
        <Film className="w-16 h-16 mb-2 opacity-20" />
        <p className="text-sm font-semibold">No media items in this folder</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0c10] select-none overflow-hidden">
      {/* ── Top Stage Canvas (macOS Gallery Main Viewer) ── */}
      <div
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {isPhoto ? (
          <img
            src={isRaw ? (rawPreviewUrl || '') : mediaUrl}
            alt={activeItem.name}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            className="max-h-full max-w-full object-contain pointer-events-none"
          />
        ) : isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            autoPlay
            loop
            muted
            playsInline
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setVideoDuration(videoRef.current?.duration || 0)}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            className="max-h-full max-w-full object-contain"
          />
        ) : null}

        {/* Prev / Next Cycling Buttons */}
        <button
          onClick={e => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={currentIdx <= 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 disabled:opacity-20 text-white backdrop-blur-md shadow-xl transition-all hover:scale-110"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            goNext();
          }}
          disabled={currentIdx >= mediaItems.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 disabled:opacity-20 text-white backdrop-blur-md shadow-xl transition-all hover:scale-110"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Floating Quick Controls Overlay */}
        <div className="absolute top-3 left-4 flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl shadow-2xl">
          <span className="text-xs font-bold text-white truncate max-w-xs">{activeItem.name}</span>
          <span className="text-[10px] text-indigo-400 font-mono uppercase bg-indigo-500/20 px-1.5 py-0.5 rounded">
            {activeItem.ext}
          </span>
          {isVideo && videoDuration > 0 && (
            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatTimelapse(videoDuration)}
            </span>
          )}
        </div>

        {/* Zoom & Snapshot Controls Toolbar */}
        <div className="absolute top-3 right-4 flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-xl shadow-2xl">
          <button
            onClick={() => setZoom(z => Math.max(1, z - 0.25))}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-indigo-300 font-bold px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(6, z + 0.25))}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoom > 1 && (
            <button
              onClick={resetZoom}
              className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-white ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {isVideo && (
            <button
              onClick={handleCaptureSnapshot}
              className="p-1 rounded hover:bg-white/10 text-emerald-400 hover:text-white ml-1"
              title="Snapshot Frame"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onOpenViewer(activeItem)}
            className="p-1 rounded hover:bg-white/10 text-indigo-400 hover:text-white ml-1"
            title="Fullscreen Inspection"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {snapshotMsg && (
          <div className="absolute bottom-4 bg-emerald-600/90 text-white text-xs px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md">
            {snapshotMsg}
          </div>
        )}
      </div>

      {/* ── Bottom Filmstrip (macOS Gallery Carousel) ── */}
      <div className="h-28 border-t border-white/10 bg-[#12141c] flex items-center px-4 overflow-x-auto gap-2.5 no-scrollbar py-2">
        {mediaItems.map(item => {
          const isSelected = item.fullPath === activeItem.fullPath;
          const isRaw = isRawExtension(item.ext);
          const isDirectPhoto = isPhotoExtension(item.ext) && !isRaw;
          const cached = isDirectPhoto ? null : thumbnailService.getCached(item.fullPath);

          return (
            <div
              key={item.fullPath}
              onClick={() => onSelectItem(item)}
              onDoubleClick={() => onOpenViewer(item)}
              className={`relative h-20 aspect-video rounded-lg overflow-hidden cursor-pointer flex-shrink-0 transition-all border ${
                isSelected
                  ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/40'
                  : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
              }`}
            >
              {isDirectPhoto ? (
                <img
                  src={mediaService.toLocalResourceUrl(item.fullPath)}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FilmstripVideoThumb item={item} cached={cached} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function FilmstripVideoThumb({ item, cached }: { item: FsItem; cached: any }) {
  const [thumb, setThumb] = useState<string | null>(cached?.thumb || null);
  const [duration, setDuration] = useState<number>(cached?.duration || 0);

  useEffect(() => {
    if (thumb) return;
    thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
      if (res) {
        setThumb(res.thumb);
        setDuration(res.duration);
      }
    });
  }, [item.fullPath, thumb]);

  return (
    <div className="w-full h-full bg-black/60 relative flex items-center justify-center">
      {thumb ? (
        <img src={thumb} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <Film className="w-6 h-6 text-purple-400 opacity-60 animate-pulse" />
      )}
      {duration > 0 && (
        <span className="absolute bottom-1 right-1 bg-black/85 text-amber-300 border border-amber-400/40 text-[9px] font-bold px-1 py-0.2 rounded">
          {formatTimelapse(duration)}
        </span>
      )}
    </div>
  );
}
