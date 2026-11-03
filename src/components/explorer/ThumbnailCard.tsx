import React, { useState, useEffect } from 'react';
import {
  Play,
  Folder,
  File,
  Clock,
  Eye,
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

interface ThumbnailCardProps {
  item: FsItem;
  onClick: () => void;
  onOpen: () => void;
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ item, onClick, onOpen }) => {
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

  // ALL non-direct photos extract thumbnail & metadata from backend!
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

    return () => {
      isCurrent = false;
    };
  }, [item.fullPath, isDirectBrowserPhoto, item.isDir]);

  // Standard photos load directly via fast local-resource URL; RAW & all other files use extracted thumbnail
  const directPhotoUrl = isDirectBrowserPhoto ? mediaService.toLocalResourceUrl(item.fullPath) : null;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onOpen}
      className="group relative flex flex-col bg-[#141620] hover:bg-[#1a1e2d] border border-white/10 hover:border-indigo-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-lg hover:shadow-indigo-500/15"
    >
      {/* Thumbnail Aspect Ratio Box */}
      <div className="relative aspect-video w-full bg-black/60 flex items-center justify-center overflow-hidden">
        {isRaw ? (
          /* Camera RAW (.CR3, .CR2, .NEF, .ARW, etc.) */
          thumb ? (
            <img
              src={thumb}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-rose-400">
              <ImageIcon className="w-8 h-8 opacity-60 animate-pulse" />
              <span className="text-[10px] font-bold text-rose-300/80 mt-1 uppercase">RAW</span>
            </div>
          )
        ) : isDirectBrowserPhoto ? (
          /* Standard Photo (JPG, PNG, WEBP, GIF, etc.) */
          !imgError ? (
            <img
              src={directPhotoUrl || ''}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => {
                setImgError(true);
                mediaService.readImageBase64(item.fullPath).then(res => {
                  if (res.ok && res.dataUrl) setThumb(res.dataUrl);
                });
              }}
            />
          ) : thumb ? (
            <img
              src={thumb}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-emerald-400">
              <ImageIcon className="w-8 h-8 opacity-60" />
            </div>
          )
        ) : isVideo ? (
          /* Video */
          thumb ? (
            <img
              src={thumb}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-purple-400">
              <Film className="w-8 h-8 opacity-60 animate-pulse" />
            </div>
          )
        ) : isAudio && thumb && !thumb.startsWith('data:image/png') ? (
          /* Audio with embedded album art */
          <img
            src={thumb}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : thumb ? (
          /* ALL OTHER FILES (Audio, PDF, Documents, Code, Archives, Executables, etc.) with Windows Shell Icon/Thumbnail! */
          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-b from-white/[0.04] to-black/60">
            <img
              src={thumb}
              alt={item.name}
              className="max-h-full max-w-full object-contain filter drop-shadow-2xl transition-transform duration-300 group-hover:scale-110"
            />
          </div>
        ) : item.isDir ? (
          <Folder className="w-12 h-12 text-amber-400/80 group-hover:scale-110 transition-transform" />
        ) : (
          <File className="w-10 h-10 text-gray-400 group-hover:scale-110 transition-transform" />
        )}

        {/* Video Duration / Timelapse Badge (e.g. 10s, 1m 20s) */}
        {isVideo && (
          <span className="absolute bottom-2 right-2 bg-black/90 backdrop-blur-md text-amber-300 border border-amber-400/50 text-[11px] font-extrabold px-2 py-0.5 rounded-md shadow-2xl flex items-center gap-1.5 z-10 tracking-wide pointer-events-none">
            <Clock className={`w-3 h-3 text-amber-400 ${loadingMeta ? 'animate-spin' : ''}`} />
            <span>
              {duration > 0 ? formatTimelapse(duration) : loadingMeta ? '...' : 'VIDEO'}
            </span>
          </span>
        )}

        {/* Audio Duration Badge */}
        {isAudio && duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/90 backdrop-blur-md text-emerald-300 border border-emerald-400/50 text-[11px] font-extrabold px-2 py-0.5 rounded-md shadow-2xl flex items-center gap-1.5 z-10 tracking-wide pointer-events-none">
            <Volume2 className="w-3 h-3 text-emerald-400" />
            <span>{formatTimelapse(duration)}</span>
          </span>
        )}

        {/* Camera RAW Badge */}
        {isRaw && (
          <span className="absolute bottom-2 right-2 bg-rose-950/80 backdrop-blur-md text-rose-300 border border-rose-500/40 text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase z-10 pointer-events-none tracking-wider">
            RAW
          </span>
        )}

        {/* Extension Pill */}
        {!item.isDir && item.ext && (
          <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-gray-200 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-white/10 z-10">
            {item.ext}
          </span>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3 backdrop-blur-[2px]">
          <button
            onClick={e => {
              e.stopPropagation();
              onOpen();
            }}
            className="p-3 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
            title="Open Studio Viewer"
          >
            {isVideo ? <Play className="w-5 h-5 ml-0.5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Item Details Info */}
      <div className="p-3 flex flex-col justify-between flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-gray-200 truncate flex-1 group-hover:text-indigo-300 transition-colors" title={item.name}>
            {item.name}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium mt-2">
          <span>{item.isDir ? 'Folder' : formatBytes(item.size)}</span>
          <span className="uppercase tracking-wider font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400">
            {item.ext || (item.isDir ? 'DIR' : 'FILE')}
          </span>
        </div>
      </div>
    </div>
  );
};
