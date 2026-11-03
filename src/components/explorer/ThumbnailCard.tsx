import React, { useState, useEffect } from 'react';
import { Play, Folder, File, Clock, Eye, Film } from 'lucide-react';
import { FsItem } from '../../types';
import { isPhotoExtension, isVideoExtension, formatBytes, formatTimelapse } from '../../utils';
import { mediaService, thumbnailService } from '../../services';

interface ThumbnailCardProps {
  item: FsItem;
  onClick: () => void;
  onOpen: () => void;
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ item, onClick, onOpen }) => {
  const isPhoto = isPhotoExtension(item.ext);
  const isVideo = isVideoExtension(item.ext);

  const cached = thumbnailService.getCached(item.fullPath);
  const [thumb, setThumb] = useState<string | null>(cached?.thumb || null);
  const [duration, setDuration] = useState<number>(cached?.duration || 0);

  useEffect(() => {
    if (!isVideo || thumb) return;
    let isCurrent = true;

    thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
      if (isCurrent && res) {
        setThumb(res.thumb);
        setDuration(res.duration);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [item.fullPath, isVideo, thumb]);

  const photoUrl = isPhoto ? mediaService.toLocalResourceUrl(item.fullPath) : null;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onOpen}
      className="group relative flex flex-col bg-[#141620] hover:bg-[#1a1e2d] border border-white/10 hover:border-indigo-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-lg hover:shadow-indigo-500/15"
    >
      {/* Thumbnail Aspect Ratio Box */}
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

        {/* Extension Pill */}
        {!item.isDir && item.ext && (
          <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-gray-300 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-white/10">
            {item.ext}
          </span>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={e => {
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
};
