import React, { useState, useEffect } from 'react';
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
  density?: 'compact' | 'normal' | 'broad';
  onClick: () => void;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
  density = 'normal',
  onClick,
  onOpen,
  onContextMenu
}) => {
  const isRaw = isRawExtension(item.ext);
  const isVideo = isVideoExtension(item.ext);
  const isPhoto = isPhotoExtension(item.ext);
  const isAudio = isAudioExtension(item.ext);
  const isDoc = isDocExtension(item.ext);
  const isDirectBrowserPhoto = isPhoto && !isRaw;

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
  const folderSize = density === 'compact' ? 56 : density === 'broad' ? 96 : 74;
  const docSize = density === 'compact' ? 52 : density === 'broad' ? 84 : 66;
  const canvasHeight = density === 'compact' ? 'h-20 sm:h-22' : density === 'broad' ? 'h-32 sm:h-36' : 'h-24 sm:h-28';
  const labelMaxWidth = density === 'compact' ? 'max-w-[110px]' : density === 'broad' ? 'max-w-[160px]' : 'max-w-[130px]';

  return (
    <div
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className={`group relative flex flex-col items-center justify-between p-2 rounded-xl cursor-pointer select-none transition-all duration-150 ${
        isSelected
          ? 'bg-black/[0.06] dark:bg-white/[0.08] ring-1 ring-[var(--mac-accent)]/40 shadow-sm'
          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
      } ${item.isHidden ? 'opacity-55 hover:opacity-100' : ''}`}
    >
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
                    SLOT {afm.slotNumber || ''}
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

      {/* ── macOS Finder Style Centered Label ── */}
      <div className="w-full mt-2 flex flex-col items-center text-center select-none px-1">
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
        <span className="text-[10.5px] text-[var(--mac-text-muted)] mt-0.5 font-normal tracking-tight">
          {item.isDir ? 'Folder' : formatBytes(item.size)}
        </span>
      </div>
    </div>
  );
};
