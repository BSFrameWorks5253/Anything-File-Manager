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
  X,
  FileCode,
  Table,
  FileText,
  Terminal,
  Archive
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isVideoExtension,
  isPhotoExtension,
  isRawExtension,
  isAudioExtension,
  isCodeOrTextExtension,
  isArchiveExtension,
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
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [folderItems, setFolderItems] = useState<FsItem[] | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const ext = (item?.ext || '').toLowerCase();
  const isVideo = item ? isVideoExtension(ext) : false;
  const isRaw = item ? isRawExtension(ext) : false;
  const isPhoto = item ? isPhotoExtension(ext) && !isRaw : false;
  const isAudio = item ? isAudioExtension(ext) : false;
  const isCodeOrText = item ? !item.isDir && (isCodeOrTextExtension(ext) || ['txt', 'md', 'json', 'log', 'env', 'yml', 'yaml', 'xml', 'sql', 'bat', 'cmd', 'ps1', 'sh', 'ini', 'toml', 'cfg'].includes(ext)) : false;
  const isCsv = !item?.isDir && (ext === 'csv' || ext === 'tsv');
  const isPdf = ext === 'pdf';
  const isApp = ['exe', 'msi', 'bat', 'cmd'].includes(ext);
  const isArchive = item ? !item.isDir && isArchiveExtension(ext) : false;

  // Load preview data dynamically based on format
  useEffect(() => {
    if (!item) return;

    if (isRaw) {
      mediaService.readImageBase64(item.fullPath).then(res => {
        if (res.ok && res.dataUrl) {
          setRawThumb(res.dataUrl);
        }
      });
    } else {
      setRawThumb(null);
    }

    if (isVideo) {
      setVideoError(false);
      const cached = thumbnailService.getCached(item.fullPath);
      if (cached?.thumb) {
        setVideoThumb(cached.thumb);
      } else {
        thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
          if (res?.thumb) setVideoThumb(res.thumb);
        });
      }
    } else {
      setVideoThumb(null);
    }

    if (isCodeOrText || isCsv) {
      mediaService.readTextFile(item.fullPath, 4096).then(res => {
        if (res.ok && res.content) {
          setTextContent(res.content);
        } else {
          setTextContent(null);
        }
      }).catch(() => setTextContent(null));
    } else {
      setTextContent(null);
    }

    if (item.isDir) {
      mediaService.listDir(item.fullPath).then(res => {
        if (res) setFolderItems(res.slice(0, 6));
      }).catch(() => setFolderItems(null));
    } else {
      setFolderItems(null);
    }
  }, [item?.fullPath, isRaw, isVideo, isCodeOrText, isCsv, item?.isDir]);

  // Reset audio & video state on item change
  useEffect(() => {
    setVideoCurrentTime(0);
    setVideoDimensions(null);
    setImageDimensions(null);
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setVideoError(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [item?.fullPath]);

  if (!isOpen || !item || !anchorRect) {
    return null;
  }

  const mediaUrl = mediaService.toLocalResourceUrl(item.fullPath);

  // Position calculation: smart placement near anchor element
  const popoverWidth = 330;
  const popoverHeight = isVideo || isPhoto || isRaw || isCodeOrText || isCsv || isPdf ? 340 : item.isDir ? 250 : 200;
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
            {videoError ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-black/90 p-4 text-center">
                {videoThumb ? (
                  <img src={videoThumb} alt={item.name} className="max-w-full max-h-36 object-contain rounded filter brightness-75 mb-2" />
                ) : (
                  <Film className="w-12 h-12 text-purple-400/50 mb-2" />
                )}
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  Hardware-Accelerated Codec ({item.ext.toUpperCase()})
                </span>
                <span className="text-[10px] text-gray-400 mt-1">Press Space for Full Quick Look</span>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  preload="auto"
                  onError={() => setVideoError(true)}
                  onLoadedMetadata={e => {
                    const target = e.currentTarget;
                    setVideoDuration(target.duration || 0);
                    setVideoDimensions({
                      width: target.videoWidth,
                      height: target.videoHeight
                    });
                    target.play().catch(() => {});
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
              </>
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
        ) : isCodeOrText ? (
          <div className="w-full h-48 bg-[#0a0c14] flex flex-col font-mono text-[11px] overflow-hidden select-text">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                <FileCode className="w-3.5 h-3.5" />
                <span>Text / Code Preview</span>
              </span>
              <span>{textContent ? `${textContent.split('\n').length} lines` : 'Reading...'}</span>
            </div>
            <div className="p-2.5 overflow-hidden leading-relaxed text-gray-300 font-mono text-[10.5px]">
              {textContent ? (
                textContent.split('\n').slice(0, 9).map((line, idx) => (
                  <div key={idx} className="flex gap-2.5 truncate">
                    <span className="text-gray-600 select-none w-4 text-right shrink-0">{idx + 1}</span>
                    <span className="truncate text-gray-200">{line || ' '}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                  Loading text preview...
                </div>
              )}
            </div>
          </div>
        ) : isCsv ? (
          <div className="w-full h-48 bg-[#0a0c14] flex flex-col font-mono text-[10px] overflow-hidden">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex items-center justify-between text-gray-400">
              <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <Table className="w-3.5 h-3.5" />
                <span>Table Data Preview</span>
              </span>
              <span className="uppercase text-[9px] text-gray-500">{item.ext}</span>
            </div>
            <div className="p-2 overflow-hidden">
              {textContent ? (
                <table className="w-full border-collapse">
                  <tbody>
                    {textContent.split(/\r?\n/).slice(0, 6).map((line, rIdx) => (
                      <tr key={rIdx} className={rIdx === 0 ? 'bg-white/10 font-bold text-indigo-300' : 'border-b border-white/5 text-gray-300'}>
                        {line.split(item.ext.toLowerCase() === 'tsv' ? '\t' : ',').slice(0, 4).map((cell, cIdx) => (
                          <td key={cIdx} className="px-1.5 py-0.5 truncate max-w-[80px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-xs">Loading table...</div>
              )}
            </div>
          </div>
        ) : isPdf ? (
          <div className="w-full h-48 bg-[#10121d] flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-20 bg-rose-600/20 border border-rose-500/40 rounded-lg flex flex-col items-center justify-center shadow-lg mb-2">
              <FileText className="w-8 h-8 text-rose-400 mb-1" />
              <span className="text-[9px] font-black uppercase text-rose-300">PDF</span>
            </div>
            <span className="text-xs font-bold text-white max-w-[240px] truncate">{item.name}</span>
            <span className="text-[10px] text-gray-400 font-mono mt-0.5">{formatBytes(item.size)}</span>
            <span className="text-[9.5px] text-indigo-400 font-semibold mt-2">Spacebar to read full PDF</span>
          </div>
        ) : isApp ? (
          <div className="w-full p-4 bg-[#0d101a] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mb-2">
              <Terminal className="w-6 h-6 text-sky-400" />
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[240px]">{item.name}</span>
            <span className="text-[10px] text-sky-300 font-mono uppercase mt-0.5">{item.ext} Executable Application</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">{formatBytes(item.size)}</span>
          </div>
        ) : isArchive ? (
          <div className="w-full p-4 bg-[#0d101a] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mb-2">
              <Archive className="w-6 h-6 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[240px]">{item.name}</span>
            <span className="text-[10px] text-amber-300 font-mono uppercase mt-0.5">{item.ext} Compressed Archive</span>
            <span className="text-[10px] text-gray-400 font-mono mt-1">{formatBytes(item.size)}</span>
          </div>
        ) : item.isDir ? (
          <div className="w-full p-3 bg-black/40 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <MacFolderIcon size={36} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white truncate block">{item.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {folderItems ? `${folderItems.length} items previewed` : (item.childCount !== undefined ? `${item.childCount} items` : 'Directory')}
                </span>
              </div>
            </div>
            {folderItems && folderItems.length > 0 && (
              <div className="bg-white/5 rounded-lg p-1.5 text-[10px] flex flex-col gap-1 max-h-24 overflow-hidden border border-white/5">
                {folderItems.slice(0, 4).map(child => (
                  <div key={child.fullPath} className="flex items-center gap-1.5 text-gray-300 truncate">
                    {child.isDir ? <MacFolderIcon size={12} /> : <MacDocumentIcon size={12} ext={child.ext} />}
                    <span className="truncate">{child.name}</span>
                    <span className="ml-auto text-[9px] text-gray-500 font-mono shrink-0">
                      {child.isDir ? 'folder' : formatBytes(child.size ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
