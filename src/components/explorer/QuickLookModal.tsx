import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Clock,
  Film,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  isRawExtension,
  formatBytes,
  formatDate,
  formatTimelapse
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';

interface QuickLookModalProps {
  item: FsItem | null;
  items?: FsItem[];
  isOpen: boolean;
  onClose: () => void;
  onOpenViewer: (item: FsItem) => void;
  onNavigate?: (item: FsItem) => void;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  item,
  items = [],
  isOpen,
  onClose,
  onOpenViewer,
  onNavigate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isRaw = item ? isRawExtension(item.ext) : false;
  const isPhoto = item ? isPhotoExtension(item.ext) : false;
  const isVideo = item ? isVideoExtension(item.ext) : false;
  const mediaUrl = item ? mediaService.toLocalResourceUrl(item.fullPath) : '';

  const [photoFallback, setPhotoFallback] = useState<string | null>(null);

  useEffect(() => {
    setPhotoFallback(null);
  }, [item?.fullPath]);

  // Extract RAW preview
  useEffect(() => {
    if (!item || !isRaw || !isOpen) {
      setRawUrl(null);
      return;
    }
    const cached = thumbnailService.getCached(item.fullPath)?.thumb;
    if (cached) setRawUrl(cached);

    let isCurrent = true;
    mediaService.readImageBase64(item.fullPath).then(res => {
      if (isCurrent && res.ok && res.dataUrl) {
        setRawUrl(res.dataUrl);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [item?.fullPath, isRaw, isOpen]);

  // Sibling media list for Quick Look Prev/Next navigation
  const mediaList = useMemo(() => {
    return items.filter(f => !f.isDir);
  }, [items]);

  const currentIndex = mediaList.findIndex(f => f.fullPath === item?.fullPath);

  const goPrev = () => {
    if (currentIndex > 0 && onNavigate) {
      onNavigate(mediaList[currentIndex - 1]);
    }
  };

  const goNext = () => {
    if (currentIndex < mediaList.length - 1 && onNavigate) {
      onNavigate(mediaList[currentIndex + 1]);
    }
  };

  // Keyboard navigation inside Quick Look
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.code === 'Space' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Enter' && item) {
        e.preventDefault();
        onClose();
        onOpenViewer(item);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goPrev, goNext, item, onOpenViewer]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`bg-[#141622]/95 border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-200 ${
          isExpanded ? 'w-[96vw] h-[92vh]' : 'max-w-4xl w-full max-h-[85vh]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* macOS Style Window Titlebar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#181b2a]">
          <div className="flex items-center gap-2">
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
                onOpenViewer(item);
              }}
              title="Open Fullscreen Studio"
            />
            <span className="text-xs font-semibold text-gray-200 ml-2 truncate max-w-sm">
              {item.name}
            </span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Quick Look
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next buttons */}
            {mediaList.length > 1 && (
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
                  {currentIndex + 1} / {mediaList.length}
                </span>
                <button
                  onClick={goNext}
                  disabled={currentIndex >= mediaList.length - 1}
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

            {/* Open in Viewer */}
            <button
              onClick={() => {
                onClose();
                onOpenViewer(item);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--mac-accent)] hover:opacity-90 text-white rounded-md text-xs font-medium shadow-sm transition-all"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Open in Viewer</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Canvas Stage */}
        <div className="flex-1 bg-black/90 flex items-center justify-center p-3 overflow-hidden min-h-[360px]">
          {isRaw ? (
            rawUrl ? (
              <img
                src={rawUrl}
                alt={item.name}
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-rose-300">
                <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-semibold">Extracting RAW Preview...</span>
              </div>
            )
          ) : isPhoto ? (
            <img
              src={photoFallback || mediaUrl}
              alt={item.name}
              onError={() => {
                if (!photoFallback && item) {
                  mediaService.readImageBase64(item.fullPath).then(res => {
                    if (res.ok && res.dataUrl) setPhotoFallback(res.dataUrl);
                  });
                }
              }}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              controls
              loop
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <Film className="w-16 h-16 mb-2 opacity-40" />
              <p className="text-sm font-semibold">{item.name}</p>
            </div>
          )}
        </div>

        {/* Bottom Information Footer */}
        <div className="px-5 py-2.5 border-t border-white/10 bg-[#161826] flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-4">
            <span>
              Size: <strong className="text-white font-mono">{formatBytes(item.size)}</strong>
            </span>
            <span>
              Modified: <strong className="text-white font-mono">{formatDate(item.mtime)}</strong>
            </span>
            <span className="uppercase text-indigo-400 font-bold">{item.ext}</span>
          </div>
          <span className="text-[11px] text-gray-500">
            Press <strong>Space</strong> or <strong>Esc</strong> to dismiss • Arrows to browse
          </span>
        </div>
      </div>
    </div>
  );
};
