import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  FolderOpen,
  Maximize2,
  Clock,
  HardDrive,
  Calendar,
  FileCode,
  Film,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  formatBytes,
  formatDate,
  formatTimelapse
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';

interface ExplorerInspectorProps {
  item: FsItem | null;
  onClose: () => void;
  onOpenViewer: (item: FsItem) => void;
}

export const ExplorerInspector: React.FC<ExplorerInspectorProps> = ({
  item,
  onClose,
  onOpenViewer
}) => {
  const [copied, setCopied] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    if (!item) return;
    setThumb(null);
    setDuration(0);

    const isVid = isVideoExtension(item.ext);
    if (isVid) {
      const cached = thumbnailService.getCached(item.fullPath);
      if (cached) {
        setThumb(cached.thumb);
        setDuration(cached.duration);
      } else {
        thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
          if (res) {
            setThumb(res.thumb);
            setDuration(res.duration);
          }
        });
      }
    }
  }, [item?.fullPath, item?.ext]);

  if (!item) {
    return (
      <div className="w-72 flex-shrink-0 border-l border-white/10 bg-[#0e1017] p-4 flex flex-col items-center justify-center text-center text-gray-500 select-none">
        <Film className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-xs font-semibold">No item selected</p>
        <p className="text-[11px] text-gray-600 mt-1">Select any photo or video to inspect details</p>
      </div>
    );
  }

  const isPhoto = isPhotoExtension(item.ext);
  const isVideo = isVideoExtension(item.ext);
  const photoUrl = isPhoto ? mediaService.toLocalResourceUrl(item.fullPath) : null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.fullPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-80 flex-shrink-0 border-l border-white/10 bg-[#0e1017] flex flex-col overflow-y-auto select-none text-gray-300">
      {/* Inspector Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#141620]">
        <span className="text-xs font-bold text-white tracking-wide uppercase">Details & Preview</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Large Preview Canvas */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden border-b border-white/10">
        {isPhoto ? (
          <img
            src={photoUrl || ''}
            alt={item.name}
            className="w-full h-full object-contain"
          />
        ) : isVideo ? (
          thumb ? (
            <img
              src={thumb}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Film className="w-12 h-12 text-indigo-400 opacity-60 animate-pulse" />
          )
        ) : (
          <FolderOpen className="w-16 h-16 text-amber-400 opacity-60" />
        )}

        {/* Video Duration Badge */}
        {isVideo && duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md text-amber-300 border border-amber-400/40 text-xs font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            {formatTimelapse(duration)}
          </span>
        )}
      </div>

      {/* Primary Action Button */}
      {(isPhoto || isVideo) && (
        <div className="p-3 border-b border-white/5">
          <button
            onClick={() => onOpenViewer(item)}
            className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Open HD Inspection & Zoom</span>
          </button>
        </div>
      )}

      {/* File Metadata Details List */}
      <div className="p-4 space-y-3 flex-1 text-xs">
        <div>
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">File Name</span>
          <p className="text-white font-semibold break-words mt-0.5">{item.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <FileCode className="w-3 h-3 text-indigo-400" />
              <span>Format</span>
            </span>
            <p className="text-gray-200 uppercase font-bold mt-0.5">{item.ext || 'DIRECTORY'}</p>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              <span>Size</span>
            </span>
            <p className="text-gray-200 font-mono mt-0.5">{item.isDir ? '—' : formatBytes(item.size)}</p>
          </div>
        </div>

        {isVideo && duration > 0 && (
          <div className="pt-2 border-t border-white/5">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Timelapse Duration</span>
            </span>
            <p className="text-amber-300 font-bold mt-0.5">{formatTimelapse(duration)} ({duration.toFixed(1)}s)</p>
          </div>
        )}

        <div className="pt-2 border-t border-white/5">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-sky-400" />
            <span>Date Modified</span>
          </span>
          <p className="text-gray-300 font-mono mt-0.5">{formatDate(item.mtime)}</p>
        </div>

        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Full Path</span>
            <button
              onClick={handleCopyPath}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 font-mono break-all bg-black/40 p-2 rounded-lg border border-white/5">
            {item.fullPath}
          </p>
        </div>
      </div>

      {/* Footer Quick Actions */}
      <div className="p-3 border-t border-white/10 bg-[#12141c] flex gap-2">
        <button
          onClick={() => mediaService.openInExplorer(item.fullPath)}
          className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Show in Explorer</span>
        </button>
      </div>
    </div>
  );
};
