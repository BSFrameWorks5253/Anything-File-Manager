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
  Check,
  Eye
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
import { MacFolderIcon, MacDocumentIcon } from '../common/MacIcons';
import { AfmInspectorPanel } from '../afm/AfmInspectorPanel';

interface ExplorerInspectorProps {
  item: FsItem | null;
  currentPath?: string;
  onClose: () => void;
  onOpenViewer: (item: FsItem) => void;
  onQuickLook?: (item: FsItem) => void;
  width?: number;
}

export const ExplorerInspector: React.FC<ExplorerInspectorProps> = ({
  item,
  currentPath,
  onClose,
  onOpenViewer,
  onQuickLook,
  width = 320
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'production'>('details');
  const [copied, setCopied] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!item) return;
    setThumb(null);
    setDuration(0);
    setImgError(false);

    const isVid = isVideoExtension(item.ext);
    const isRaw = isRawExtension(item.ext);
    if (isVid || isRaw) {
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

  // When a folder is selected or no item is selected (fallback to current opened directory)
  if (!item && currentPath) {
    const folderName = currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath;
    return (
      <div
        style={{ width: `${width}px` }}
        className="flex-shrink-0 border-l mac-sidebar flex flex-col overflow-y-auto select-none text-[var(--mac-text-primary)] transition-colors duration-200"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b mac-header">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold tracking-wide truncate">Workspace Analytics</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
            title="Close Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <AfmInspectorPanel folderPath={currentPath} folderName={folderName} />
      </div>
    );
  }

  if (!item) {
    return (
      <div
        style={{ width: `${width}px` }}
        className="flex-shrink-0 border-l mac-sidebar p-4 flex flex-col items-center justify-center text-center text-[var(--mac-text-muted)] select-none transition-colors duration-200"
      >
        <Film className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-xs font-semibold">No item selected</p>
        <p className="text-[11px] mt-1">Select any photo, video, or folder to inspect details</p>
      </div>
    );
  }

  // If selected item is a folder, show the AFM Production Inspector for that folder
  if (item.isDir) {
    return (
      <div
        style={{ width: `${width}px` }}
        className="flex-shrink-0 border-l mac-sidebar flex flex-col overflow-y-auto select-none text-[var(--mac-text-primary)] transition-colors duration-200"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b mac-header">
          <div className="flex items-center gap-2 min-w-0">
            <MacFolderIcon size={18} />
            <span className="text-xs font-semibold tracking-wide truncate">{item.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
            title="Close Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <AfmInspectorPanel folderPath={item.fullPath} folderName={item.name} />
      </div>
    );
  }

  const isRaw = isRawExtension(item.ext);
  const isPhoto = isPhotoExtension(item.ext);
  const isVideo = isVideoExtension(item.ext);
  const photoUrl = isPhoto && !isRaw ? mediaService.toLocalResourceUrl(item.fullPath) : null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.fullPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className="flex-shrink-0 border-l mac-sidebar flex flex-col overflow-y-auto select-none text-[var(--mac-text-primary)] transition-colors duration-200"
    >
      {/* Inspector Header with Tab Switcher */}
      <div className="flex items-center justify-between px-3 py-2 border-b mac-header gap-2">
        <div className="flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-[11px] font-medium">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeTab === 'details'
                ? 'bg-white dark:bg-neutral-800 text-[var(--mac-text-primary)] shadow-sm font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
          >
            File Details
          </button>
          {currentPath && (
            <button
              onClick={() => setActiveTab('production')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === 'production'
                  ? 'bg-white dark:bg-neutral-800 text-[var(--mac-text-primary)] shadow-sm font-semibold'
                  : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
              }`}
            >
              Folder AFM
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {activeTab === 'production' && currentPath ? (
        <AfmInspectorPanel
          folderPath={currentPath}
          folderName={currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath}
        />
      ) : (
        <>
          {/* Large Preview Canvas */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden border-b border-white/10">
        {isRaw ? (
          thumb ? (
            <img
              src={thumb}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-rose-400">
              <ImageIcon className="w-10 h-10 opacity-60 animate-pulse" />
              <span className="text-[10px] font-bold text-rose-300 mt-1 uppercase">RAW Preview Loading</span>
            </div>
          )
        ) : isPhoto ? (
          <img
            src={imgError && thumb ? thumb : (photoUrl || thumb || '')}
            alt={item.name}
            onError={() => {
              setImgError(true);
              if (!thumb) {
                mediaService.readImageBase64(item.fullPath).then(res => {
                  if (res.ok && res.dataUrl) setThumb(res.dataUrl);
                });
              }
            }}
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
        ) : item.isDir ? (
          <MacFolderIcon size={84} />
        ) : (
          <MacDocumentIcon size={76} ext={item.ext} />
        )}

        {/* Video Duration Badge */}
        {isVideo && duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md text-amber-300 border border-amber-400/40 text-xs font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            {formatTimelapse(duration)}
          </span>
        )}
      </div>

      {/* Primary Action Buttons */}
      {(isPhoto || isVideo) && (
        <div className="p-3 border-b border-white/5 flex flex-col gap-2">
          <button
            onClick={() => onQuickLook?.(item)}
            className="w-full py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 hover:border-indigo-500/50 transition-all"
          >
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Quick Look Preview (Space)</span>
          </button>
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
        </>
      )}
    </div>
  );
};
