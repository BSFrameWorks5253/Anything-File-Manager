import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
  HardDrive,
  Calendar,
  Sparkles,
  Play,
  Pause,
  X
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isVideoExtension,
  isPhotoExtension,
  isRawExtension,
  isAudioExtension,
  formatBytes,
  formatTimelapse
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { MacFolderIcon, MacDocumentIcon } from './MacIcons';

interface HoverMediaPreviewProps {
  item: FsItem | null;
  anchorRect: DOMRect | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickLook: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
  onMouseEnterPopover?: () => void;
  onMouseLeavePopover?: () => void;
}

export const HoverMediaPreview: React.FC<HoverMediaPreviewProps> = ({
  item,
  anchorRect,
  isOpen,
  onClose,
  onOpenQuickLook,
  onOpenItem,
  onMouseEnterPopover,
  onMouseLeavePopover
}) => {
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [rawThumb, setRawThumb] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isVideo = item ? isVideoExtension(item.ext) : false;
  const isRaw = item ? isRawExtension(item.ext) : false;
  const isPhoto = item ? isPhotoExtension(item.ext) && !isRaw : false;
  const isAudio = item ? isAudioExtension(item.ext) : false;

  // Load RAW thumbnail if raw
  useEffect(() => {
    if (item && isRaw) {
      mediaService.readImageBase64(item.fullPath).then(res => {
        if (res.ok && res.dataUrl) {
          setRawThumb(res.dataUrl);
        }
      });
    } else {
      setRawThumb(null);
    }
  }, [item?.fullPath, isRaw]);

  // Reset audio & video state on item change
  useEffect(() => {
    setVideoCurrentTime(0);
    setVideoDimensions(null);
    setImageDimensions(null);
    setIsPlayingAudio(false);
    setAudioProgress(0);
  }, [item?.fullPath]);

  if (!isOpen || !item || !anchorRect) {
    return null;
  }

  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);

  // Position calculation: smart placement near anchor element
  const popoverWidth = 330;
  const popoverHeight = isVideo || isPhoto || isRaw ? 340 : 200;
  const margin = 12;

  let left = anchorRect.right + margin;
  // If overflows right edge of viewport, place to the left of the item
  if (left + popoverWidth > window.innerWidth - 10) {
    left = anchorRect.left - popoverWidth - margin;
  }
  // Clamp horizontal within screen
  if (left < 10) left = 10;
  if (left + popoverWidth > window.innerWidth - 10) {
    left = window.innerWidth - popoverWidth - 10;
  }

  // Vertical alignment centered to anchor rect
  let top = anchorRect.top + (anchorRect.height / 2) - (popoverHeight / 2);
  // Clamp vertical within screen
  if (top < 16) top = 16;
  if (top + popoverHeight > window.innerHeight - 16) {
    top = window.innerHeight - popoverHeight - 16;
  }

  const handleVideoScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setVideoCurrentTime(video.currentTime);
  };

  const toggleAudioPlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      audio.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  return (
    <div
      ref={popoverRef}
      onMouseEnter={onMouseEnterPopover}
      onMouseLeave={onMouseLeavePopover}
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`
      }}
      className="fixed z-50 pointer-events-auto bg-[#0a0d14]/90 dark:bg-[#07090f]/95 backdrop-blur-2xl border border-white/15 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-100 select-none animate-in fade-in zoom-in-95 duration-150 transition-all"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.04]">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {isVideo ? (
            <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          ) : isPhoto || isRaw ? (
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : isAudio ? (
            <Volume2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          ) : item.isDir ? (
            <MacFolderIcon size={14} />
          ) : (
            <MacDocumentIcon size={14} ext={item.ext} />
          )}
          <span className="text-xs font-semibold truncate text-white" title={item.name}>
            {item.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase bg-white/10 text-neutral-300 border border-white/10">
            {item.isDir ? 'DIR' : item.ext || 'FILE'}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Preview"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Preview Body */}
      <div className="relative w-full bg-black/60 flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <div className="relative w-full h-48 bg-black flex items-center justify-center group/video">
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              muted={isMuted}
              loop
              playsInline
              onLoadedMetadata={e => {
                const target = e.currentTarget;
                setVideoDuration(target.duration || 0);
                setVideoDimensions({
                  width: target.videoWidth,
                  height: target.videoHeight
                });
              }}
              onTimeUpdate={e => {
                setVideoCurrentTime(e.currentTarget.currentTime);
              }}
              className="w-full h-full object-contain"
            />

            {/* Top Info Overlay: Dimensions & Audio Toggle */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              {videoDimensions && (
                <span className="bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-200 border border-white/15">
                  {videoDimensions.width}×{videoDimensions.height}{' '}
                  {videoDimensions.width >= 3840 ? '4K' : videoDimensions.width >= 1920 ? '1080p' : ''}
                </span>
              )}
              <button
                onClick={() => setIsMuted(m => !m)}
                className="pointer-events-auto p-1.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 transition-all hover:scale-105"
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>

            {/* Bottom Scrubber Bar on Video Hover */}
            <div
              onClick={handleVideoScrub}
              onMouseMove={handleVideoScrub}
              className="absolute bottom-0 left-0 right-0 h-4 group-hover/video:h-5 bg-gradient-to-t from-black/80 to-transparent flex items-end cursor-ew-resize transition-all"
            >
              <div className="w-full h-1.5 group-hover/video:h-2 bg-white/20 relative">
                <div
                  style={{
                    width: videoDuration > 0 ? `${(videoCurrentTime / videoDuration) * 100}%` : '0%'
                  }}
                  className="h-full bg-gradient-to-r from-purple-500 to-sky-400 relative"
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md transform scale-0 group-hover/video:scale-100 transition-transform" />
                </div>
              </div>
            </div>

            {/* Floating Timecode Pill */}
            {videoDuration > 0 && (
              <div className="absolute bottom-3 left-2 pointer-events-none bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-amber-300 border border-amber-500/30">
                {formatTimelapse(videoCurrentTime)} / {formatTimelapse(videoDuration)}
              </div>
            )}
          </div>
        ) : isPhoto || isRaw ? (
          <div className="relative w-full h-48 bg-black/40 flex items-center justify-center p-2">
            <img
              src={rawThumb || mediaUrl}
              alt={item.name}
              onLoad={e => {
                const target = e.currentTarget;
                setImageDimensions({
                  width: target.naturalWidth,
                  height: target.naturalHeight
                });
              }}
              className="max-w-full max-h-full object-contain rounded-lg shadow"
            />
            {imageDimensions && (
              <span className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-200 border border-white/20">
                {imageDimensions.width}×{imageDimensions.height}
              </span>
            )}
            {isRaw && (
              <span className="absolute top-3 left-3 bg-rose-600/90 text-white px-1.5 py-0.5 rounded text-[9.5px] font-black tracking-wider uppercase border border-white/20">
                RAW
              </span>
            )}
          </div>
        ) : isAudio ? (
          <div className="w-full p-4 flex flex-col items-center justify-center gap-3 bg-sky-950/20">
            <audio
              ref={audioRef}
              src={mediaUrl}
              onTimeUpdate={e => {
                const target = e.currentTarget;
                if (target.duration) {
                  setAudioProgress((target.currentTime / target.duration) * 100);
                  setVideoCurrentTime(target.currentTime);
                  setVideoDuration(target.duration);
                }
              }}
              onEnded={() => setIsPlayingAudio(false)}
            />
            {/* Animated Waveform Visualization */}
            <div className="flex items-center justify-center gap-1 h-12 w-full px-4">
              {[40, 70, 25, 90, 50, 85, 30, 60, 100, 45, 80, 35, 95, 65, 30, 75, 55, 90, 40].map((h, i) => (
                <div
                  key={i}
                  style={{
                    height: isPlayingAudio ? `${Math.max(15, (h * Math.sin((i + Date.now() / 150))))}%` : `${h * 0.4}%`
                  }}
                  className={`w-1.5 rounded-full transition-all duration-100 ${
                    isPlayingAudio ? 'bg-gradient-to-t from-sky-500 to-indigo-400' : 'bg-neutral-600'
                  }`}
                />
              ))}
            </div>

            <div className="w-full flex items-center justify-between gap-3">
              <button
                onClick={toggleAudioPlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs shadow-md transition-all"
              >
                {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                <span>{isPlayingAudio ? 'Pause' : 'Audition'}</span>
              </button>
              {videoDuration > 0 && (
                <span className="font-mono text-xs text-sky-300">
                  {formatTimelapse(videoCurrentTime)} / {formatTimelapse(videoDuration)}
                </span>
              )}
            </div>
          </div>
        ) : item.isDir ? (
          <div className="w-full p-4 flex items-center gap-3">
            <MacFolderIcon size={44} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{item.name}</span>
              <span className="text-xs text-neutral-400">
                {item.childCount !== undefined ? `${item.childCount} items` : 'Directory'}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full p-4 flex items-center gap-3">
            <MacDocumentIcon size={40} ext={item.ext} />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">{item.name}</span>
              <span className="text-[11px] text-neutral-400">{formatBytes(item.size)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Overview Strip */}
      <div className="px-3 py-2 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-300">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3 h-3 text-neutral-400" />
          <span>{formatBytes(item.size)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-neutral-400" />
          <span>{new Date(item.mtime).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Footer Quick Action Bar */}
      <div className="px-3 py-2 bg-white/[0.04] border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onOpenQuickLook(item);
              onClose();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white font-medium text-[11px] transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Quick Look</span>
            <kbd className="text-[9px] font-mono bg-black/40 px-1 py-0.2 rounded border border-white/20 ml-0.5">Space</kbd>
          </button>

          <button
            onClick={() => {
              onOpenItem(item);
              onClose();
            }}
            className="px-2.5 py-1 rounded-md bg-[#007AFF] hover:bg-[#0066d6] text-white font-medium text-[11px] transition-colors"
          >
            Open
          </button>
        </div>

        <span className="text-[10px] text-neutral-400 font-mono">
          Hover Preview
        </span>
      </div>
    </div>
  );
};
