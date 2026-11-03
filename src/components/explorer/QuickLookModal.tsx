import React, { useEffect, useRef } from 'react';
import { X, Maximize2, Clock, Film } from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  formatBytes,
  formatDate,
  formatTimelapse
} from '../../utils';
import { mediaService } from '../../services';

interface QuickLookModalProps {
  item: FsItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenViewer: (item: FsItem) => void;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  item,
  isOpen,
  onClose,
  onOpenViewer
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.code === 'Space' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const isPhoto = isPhotoExtension(item.ext);
  const isVideo = isVideoExtension(item.ext);
  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141622]/95 border border-white/15 rounded-2xl max-w-4xl max-h-[85vh] w-full flex flex-col shadow-2xl overflow-hidden backdrop-blur-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* macOS Style Window Titlebar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#181b2a]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] cursor-pointer" onClick={onClose} />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            <span className="text-xs font-semibold text-gray-300 ml-2 truncate max-w-md">
              {item.name} — Quick Look
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenViewer(item);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Open in Fullscreen</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Canvas */}
        <div className="flex-1 bg-black flex items-center justify-center p-2 min-h-[400px] max-h-[60vh] overflow-hidden">
          {isPhoto ? (
            <img
              src={mediaUrl}
              alt={item.name}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              controls
              loop
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <Film className="w-16 h-16 mb-2 opacity-40" />
              <p className="text-sm font-semibold">{item.name}</p>
            </div>
          )}
        </div>

        {/* Bottom Information Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#161826] flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-4">
            <span>Size: <strong className="text-white font-mono">{formatBytes(item.size)}</strong></span>
            <span>Modified: <strong className="text-white font-mono">{formatDate(item.mtime)}</strong></span>
            <span className="uppercase text-indigo-400 font-bold">{item.ext}</span>
          </div>
          <span className="text-[11px] text-gray-500">Press Space or Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
};
