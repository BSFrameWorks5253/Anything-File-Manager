import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Film,
  Image as ImageIcon,
  Volume2
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  isRawExtension,
  isAudioExtension,
  isDocExtension,
  formatBytes,
  formatTimelapse
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { MacFolderIcon, MacDocumentIcon } from '../common/MacIcons';
import { classifyFolder } from '../../utils/afmTaxonomy';

interface ThumbnailCardProps {
  item: FsItem;
  isSelected?: boolean;
  isCut?: boolean;
  isRenaming?: boolean;
  colorTag?: string | null;
  density?: 'compact' | 'normal' | 'broad';
  onClick: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onCommitRename?: (newName: string) => void;
  onCancelRename?: () => void;
}

function getFolderType(name: string): 'generic' | 'desktop' | 'downloads' | 'pictures' | 'videos' | 'documents' | 'home' {
  const lower = name.toLowerCase();
  if (lower === 'desktop') return 'desktop';
  if (lower === 'downloads' || lower === 'download') return 'downloads';
  if (lower === 'pictures' || lower === 'photos' || lower === 'images') return 'pictures';
  if (lower === 'videos' || lower === 'movies') return 'videos';
  if (lower === 'documents' || lower === 'docs') return 'documents';
  if (lower === 'home' || lower === 'user' || lower === 'users') return 'home';
  return 'generic';
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  item,
  isSelected = false,
  isCut = false,
  isRenaming = false,
  colorTag = null,
  density = 'normal',
  onClick,
  onOpen,
  onContextMenu,
  onCommitRename,
  onCancelRename
}) => {
  const isRaw = isRawExtension(item.ext);
  const isVideo = isVideoExtension(item.ext);
  const isPhoto = isPhotoExtension(item.ext);
  const isAudio = isAudioExtension(item.ext);
  const isDoc = isDocExtension(item.ext);
  const isDirectBrowserPhoto = isPhoto && !isRaw;

  const [renameVal, setRenameVal] = useState(item.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRenameVal(item.name);
  }, [item.name]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      const dotIdx = item.name.lastIndexOf('.');
      if (!item.isDir && dotIdx > 0) {
        renameInputRef.current.setSelectionRange(0, dotIdx);
      } else {
        renameInputRef.current.select();
      }
    }
  }, [isRenaming, item.name, item.isDir]);

  const cached = thumbnailService.getCached(item.fullPath);
  const [thumb, setThumb] = useState<string | null>(cached?.thumb || null);
  const [duration, setDuration] = useState<number>(cached?.duration || 0);
  const [loadingMeta, setLoadingMeta] = useState<boolean>(!cached && !isDirectBrowserPhoto && !item.isDir);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (isDirectBrowserPhoto || item.isDir) return;

    const currentCached = thumbnailService.getCached(item.fullPath);
    if (currentCached && currentCached.thumb) {
      setThumb(currentCached.thumb);
      setDuration(currentCached.duration);
      setLoadingMeta(false);
      return;
    }

    let isCurrent = true;
    setLoadingMeta(true);

    thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
      if (isCurrent) {
        if (res && res.thumb) {
          setThumb(res.thumb);
          setDuration(res.duration);
        }
        setLoadingMeta(false);
      }
    });

    // For camera RAW photos (.CR3, .CR2, .NEF, etc.), also read embedded high-res preview directly
    if (isRaw) {
      mediaService.readImageBase64(item.fullPath).then(res => {
        if (isCurrent && res.ok && res.dataUrl) {
          setThumb(res.dataUrl);
          setLoadingMeta(false);
        }
      });
    }

    return () => {
      isCurrent = false;
    };
  }, [item.fullPath, isDirectBrowserPhoto, item.isDir, isRaw]);

  const directPhotoUrl = isDirectBrowserPhoto ? mediaService.toLocalResourceUrl(item.fullPath) : null;

  // Density dimensions
  const folderSize = density === 'compact' ? 52 : density === 'broad' ? 90 : 68;
  const docSize = density === 'compact' ? 48 : density === 'broad' ? 80 : 62;
  const canvasHeight = density === 'compact' ? 'h-18' : density === 'broad' ? 'h-28' : 'h-22';
  const cardHeight = density === 'compact' ? 'h-32' : density === 'broad' ? 'h-46' : 'h-38';
  const cardMaxWidth = density === 'compact' ? 'max-w-[110px]' : density === 'broad' ? 'max-w-[165px]' : 'max-w-[134px]';
  const labelMaxWidth = density === 'compact' ? 'max-w-[100px]' : density === 'broad' ? 'max-w-[150px]' : 'max-w-[124px]';

  return (
    <div
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className={`group relative flex flex-col items-center justify-start p-2 rounded-xl cursor-pointer select-none transition-all duration-150 w-full ${cardHeight} ${cardMaxWidth} ${
        isSelected
          ? 'bg-black/[0.06] dark:bg-white/[0.08] ring-1 ring-[var(--mac-accent)]/40 shadow-sm'
          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
      } ${item.isHidden ? 'opacity-55 hover:opacity-100' : ''} ${isCut ? 'opacity-40 filter grayscale-[40%]' : ''}`}
    >
      {/* ── Apple Style Color Tag Badge ── */}
      {colorTag && (
        <span
          style={{ backgroundColor: colorTag }}
          className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-white/30 z-20"
          title={`Tag: ${colorTag}`}
        />
      )}

      {/* ── Icon / Thumbnail Canvas ── */}
      <div className={`w-full ${canvasHeight} flex items-center justify-center relative overflow-hidden`}>
        {item.isDir ? (
          /* Authentic Apple macOS Aqua Blue Folder */
          <div className="relative group-hover:scale-105 transition-transform duration-200">
            <MacFolderIcon size={folderSize} type={getFolderType(item.name)} />
            {(() => {
              const afm = classifyFolder(item.name, item.fullPath);
              if (afm.type === 'slot_item_a' || afm.type === 'slot_item_b') {
                return (
                  <span className="absolute -top-1 -right-1 bg-indigo-600/90 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shadow border border-white/20 tracking-wider">
                    SLOT {afm.slotTokens?.slotNo || ''}
                  </span>
                );
              }
              if (afm.type === 'date_session') {
                return (
                  <span className="absolute -top-1 -right-1 bg-purple-600/90 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shadow border border-white/20 tracking-wider">
                    SESSION
                  </span>
                );
              }
              if (afm.type === 'master_safar') {
                return (
                  <span className="absolute -top-1 -right-1 bg-amber-600/90 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shadow border border-white/20 tracking-wider">
                    SAFAR
                  </span>
                );
              }
              return null;
            })()}
          </div>
        ) : isRaw ? (
          /* Camera RAW (.CR3, .CR2, .NEF, .ARW, etc.) */
          thumb && !imgError ? (
            <div className="relative w-full h-full p-1 flex items-center justify-center">
              <img
                src={thumb}
                alt={item.name}
                onError={() => {
                  setImgError(true);
                  mediaService.readImageBase64(item.fullPath).then(res => {
                    if (res.ok && res.dataUrl) {
                      setThumb(res.dataUrl);
                      setImgError(false);
                    }
                  });
                }}
                className="max-h-full max-w-full object-cover rounded-lg shadow-sm border border-black/10 dark:border-white/10 group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute bottom-2 right-2 bg-rose-950/80 backdrop-blur-md text-rose-300 border border-rose-500/40 text-[9px] font-black px-1.5 py-0.5 rounded shadow uppercase tracking-wider pointer-events-none">
                RAW
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-rose-500 dark:text-rose-400">
              <ImageIcon className={`w-10 h-10 opacity-70 ${loadingMeta ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-300 mt-1 uppercase tracking-wider">
                RAW
              </span>
            </div>
          )
        ) : isDirectBrowserPhoto ? (
          /* Standard Photo (JPG, PNG, WEBP, GIF, etc.) */
          <div className="relative w-full h-full p-1 flex items-center justify-center">
            <img
              src={imgError && thumb ? thumb : (directPhotoUrl || '')}
              alt={item.name}
              loading="lazy"
              onError={() => {
                setImgError(true);
                mediaService.readImageBase64(item.fullPath).then(res => {
                  if (res.ok && res.dataUrl) {
                    setThumb(res.dataUrl);
                    setImgError(false);
                  }
                });
              }}
              className="max-h-full max-w-full object-cover rounded-lg shadow-sm border border-black/10 dark:border-white/10 group-hover:scale-105 transition-transform duration-200"
            />
          </div>
        ) : isVideo ? (
          /* Video Thumbnail */
          <div className="relative w-full h-full p-1 flex items-center justify-center">
            {thumb ? (
              <img
                src={thumb}
                alt={item.name}
                className="max-h-full max-w-full object-cover rounded-lg shadow-sm border border-black/10 dark:border-white/10 group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-purple-500 dark:text-purple-400">
                <Film className="w-10 h-10 opacity-60 animate-pulse" />
              </div>
            )}
            {/* Video Duration / Timelapse Badge */}
            {duration > 0 && (
              <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-amber-300 border border-amber-400/40 text-[9.5px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 tracking-wide pointer-events-none">
                <Clock className="w-2.5 h-2.5 text-amber-400" />
                <span>{formatTimelapse(duration)}</span>
              </span>
            )}
          </div>
        ) : isAudio && thumb && !thumb.startsWith('data:image/svg') ? (
          /* Audio with embedded album art */
          <div className="relative w-full h-full p-1 flex items-center justify-center">
            <img
              src={thumb}
              alt={item.name}
              className="max-h-full max-w-full object-cover rounded-lg shadow-sm border border-black/10 dark:border-white/10 group-hover:scale-105 transition-transform duration-200"
            />
            {duration > 0 && (
              <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-emerald-300 border border-emerald-400/40 text-[9.5px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 tracking-wide pointer-events-none">
                <Volume2 className="w-2.5 h-2.5 text-emerald-400" />
                <span>{formatTimelapse(duration)}</span>
              </span>
            )}
          </div>
        ) : (item.ext === 'exe' || item.ext === 'lnk') && thumb && !thumb.startsWith('data:image/svg') ? (
          /* Sharp Native Application / Shortcut Icon */
          <div className="w-full h-full flex items-center justify-center p-2 relative">
            <img
              src={thumb}
              alt={item.name}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-200"
            />
            {item.ext === 'lnk' && (
              <span className="absolute bottom-2 right-3 bg-white dark:bg-neutral-800 text-sky-500 rounded p-0.5 shadow border border-black/10">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </span>
            )}
          </div>
        ) : (
          /* Pixel-Perfect High-DPI Vector Document Sheet (PDF, XLSX, TS, JS, BAT, ZIP, etc. — Never Blurry!) */
          <div className="relative group-hover:scale-105 transition-transform duration-200">
            <MacDocumentIcon size={docSize} ext={item.ext} />
          </div>
        )}
      </div>

      {/* ── macOS Finder Style Centered Label or Inline Rename Input ── */}
      <div className="w-full mt-2 flex flex-col items-center text-center select-none px-1">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommitRename?.(renameVal);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename?.();
              }
            }}
            onBlur={() => onCommitRename?.(renameVal)}
            className="w-full text-xs bg-white dark:bg-[#1a1c29] text-neutral-900 dark:text-white border-2 border-[var(--mac-accent)] rounded-md px-1.5 py-0.5 outline-none shadow-xl text-center font-medium"
          />
        ) : (
          <span
            className={`text-xs leading-snug line-clamp-2 px-1.5 py-0.5 rounded transition-all break-words ${labelMaxWidth} ${
              isSelected
                ? 'bg-[var(--mac-accent)] text-white font-medium shadow-sm'
                : 'text-[var(--mac-text-primary)] font-normal group-hover:text-[var(--mac-accent)]'
            }`}
            title={item.name}
          >
            {item.name}
          </span>
        )}
        <span className="text-[10.5px] text-[var(--mac-text-muted)] mt-0.5 font-normal tracking-tight">
          {item.isDir
            ? (item.childCount !== undefined ? `${item.childCount} ${item.childCount === 1 ? 'item' : 'items'}` : 'Folder')
            : formatBytes(item.size)}
        </span>
      </div>
    </div>
  );
};
