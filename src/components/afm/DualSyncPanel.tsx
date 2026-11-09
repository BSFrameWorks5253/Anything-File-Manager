import React, { useState, useEffect } from 'react';
import {
  Film,
  Camera,
  FolderOpen,
  Calendar,
  Layers,
  RefreshCw,
  ExternalLink,
  ArrowLeftRight,
  X,
  Play,
  Eye,
  Maximize2,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FsItem } from '../../types';
import { mediaService, thumbnailService } from '../../services';
import { isPhotoExtension, isVideoExtension, formatBytes } from '../../utils';

export interface DualSyncConfig {
  videoPath?: string;
  photoPath?: string;
  folderName?: string;
  date?: string;
  slot?: string;
}

interface DualSyncPanelProps {
  config: DualSyncConfig;
  onClose: () => void;
  onPreviewItem?: (item: FsItem) => void;
}

export const DualSyncPanel: React.FC<DualSyncPanelProps> = ({
  config,
  onClose,
  onPreviewItem,
}) => {
  const [videoItems, setVideoItems] = useState<FsItem[]>([]);
  const [photoItems, setPhotoItems] = useState<FsItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<FsItem | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<FsItem | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const videoDir = config.videoPath || '';
  const photoDir = config.photoPath || '';
  const folderTitle = config.folderName || (videoDir ? videoDir.split(/[\\/]/).pop() : 'Media Session');
  const dateStr = config.date || 'Auto Date';
  const slotStr = config.slot || 'Unified Slot';

  const loadDirectories = async () => {
    if (videoDir) {
      setLoadingVideos(true);
      try {
        const items = await mediaService.listDir(videoDir);
        const vids = items.filter((i) => !i.isDir && isVideoExtension(i.ext));
        setVideoItems(vids.length > 0 ? vids : items.filter((i) => !i.isDir));
      } catch (e) {
        console.error('Failed to load video folder:', e);
      } finally {
        setLoadingVideos(false);
      }
    }

    if (photoDir) {
      setLoadingPhotos(true);
      try {
        const items = await mediaService.listDir(photoDir);
        const photos = items.filter((i) => !i.isDir && isPhotoExtension(i.ext));
        setPhotoItems(photos.length > 0 ? photos : items.filter((i) => !i.isDir));
      } catch (e) {
        console.error('Failed to load photo folder:', e);
      } finally {
        setLoadingPhotos(false);
      }
    }
  };

  useEffect(() => {
    loadDirectories();
  }, [videoDir, photoDir]);

  const handleOpenExplorer = (p?: string) => {
    if (p) {
      mediaService.openInExplorer(p);
    }
  };

  const videoSide = (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 14,
        border: '1px solid rgba(56, 189, 248, 0.25)',
        overflow: 'hidden',
      }}
    >
      {/* Pane Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(56, 189, 248, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8',
            }}
          >
            <Film size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9' }}>
                Video Clips Side
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(56, 189, 248, 0.18)',
                  color: '#38BDF8',
                }}
              >
                {videoItems.length} CLIPS
              </span>
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: '#94A3B8',
                fontFamily: 'monospace',
                marginTop: 2,
                maxWidth: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={videoDir}
            >
              {videoDir || 'No video directory specified'}
            </div>
          </div>
        </div>

        {videoDir && (
          <button
            onClick={() => handleOpenExplorer(videoDir)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#CBD5E1',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Open in Windows Explorer"
          >
            <FolderOpen size={12} />
            <span>Explorer</span>
          </button>
        )}
      </div>

      {/* Pane Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {loadingVideos ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Scanning video clips...
          </div>
        ) : videoItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 12 }}>
            No video files found in this path.
          </div>
        ) : (
          videoItems.map((item, idx) => {
            const isSelected = selectedVideo?.fullPath === item.fullPath;
            return (
              <div
                key={item.fullPath}
                onClick={() => {
                  setSelectedVideo(item);
                  if (onPreviewItem) onPreviewItem(item);
                  else {
                    const localUrl = (window as any).mediaViewerAPI?.toLocalResourceUrl
                      ? (window as any).mediaViewerAPI.toLocalResourceUrl(item.fullPath)
                      : item.fullPath;
                    setVideoPreviewUrl(localUrl);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#64748B',
                    width: 22,
                    fontFamily: 'monospace',
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38BDF8',
                    flexShrink: 0,
                  }}
                >
                  <Play size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isSelected ? '#38BDF8' : '#F1F5F9',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, display: 'flex', gap: 10 }}>
                    <span>{formatBytes(item.size)}</span>
                    <span>{new Date(item.mtime).toLocaleTimeString()}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    mediaService.openInExplorer(item.fullPath);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Locate file"
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const photoSide = (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 14,
        border: '1px solid rgba(139, 92, 246, 0.25)',
        overflow: 'hidden',
      }}
    >
      {/* Pane Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(139, 92, 246, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A78BFA',
            }}
          >
            <Camera size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9' }}>
                Photo Stills Side
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(139, 92, 246, 0.18)',
                  color: '#A78BFA',
                }}
              >
                {photoItems.length} PHOTOS
              </span>
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: '#94A3B8',
                fontFamily: 'monospace',
                marginTop: 2,
                maxWidth: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={photoDir}
            >
              {photoDir || 'No photo directory specified'}
            </div>
          </div>
        </div>

        {photoDir && (
          <button
            onClick={() => handleOpenExplorer(photoDir)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#CBD5E1',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Open in Windows Explorer"
          >
            <FolderOpen size={12} />
            <span>Explorer</span>
          </button>
        )}
      </div>

      {/* Pane Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 10,
          alignContent: 'start',
        }}
      >
        {loadingPhotos ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Scanning photos...
          </div>
        ) : photoItems.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#64748B', fontSize: 12 }}>
            No photo files found in this path.
          </div>
        ) : (
          photoItems.map((item) => {
            const isSelected = selectedPhoto?.fullPath === item.fullPath;
            const thumbUrl = (window as any).mediaViewerAPI?.toLocalResourceUrl
              ? (window as any).mediaViewerAPI.toLocalResourceUrl(item.fullPath)
              : item.fullPath;

            return (
              <div
                key={item.fullPath}
                onClick={() => {
                  setSelectedPhoto(item);
                  if (onPreviewItem) onPreviewItem(item);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1.5px solid #A78BFA' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    height: 100,
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={thumbUrl}
                    alt={item.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                <div style={{ padding: '6px 8px' }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: isSelected ? '#A78BFA' : '#E2E8F0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 2 }}>
                    {formatBytes(item.size)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#090D16',
        color: '#F8FAFC',
        overflow: 'hidden',
        padding: 12,
        gap: 12,
      }}
    >
      {/* ── TOP HEADER (UPAR) ── */}
      <div
        style={{
          padding: '14px 20px',
          borderRadius: 14,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Left Info: Folder Name + Date + Slot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '4px 9px',
                borderRadius: 6,
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                letterSpacing: 0.5,
              }}
            >
              DUAL SYNC VIEW
            </span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#F8FAFC' }}>
              {folderTitle}
            </h2>
          </div>

          <div style={{ height: 20, width: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

          {/* Date Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: '#34D399',
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(52, 211, 153, 0.25)',
            }}
          >
            <Calendar size={13} />
            <span>Date: {dateStr}</span>
          </div>

          {/* Slot Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: '#F472B6',
              backgroundColor: 'rgba(244, 114, 182, 0.12)',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(244, 114, 182, 0.25)',
            }}
          >
            <Layers size={13} />
            <span>Slot: {slotStr}</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setIsSwapped((prev) => !prev)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#E2E8F0',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Swap Video and Photo pane positions"
          >
            <ArrowLeftRight size={13} />
            <span>Swap Panes</span>
          </button>

          <button
            onClick={loadDirectories}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#E2E8F0',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Refresh directories"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.35)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#FCA5A5',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Return to standard single file explorer"
          >
            <X size={14} />
            <span>Close Dual View</span>
          </button>
        </div>
      </div>

      {/* ── DUAL SIDE-BY-SIDE PANES ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 12,
          overflow: 'hidden',
        }}
      >
        {isSwapped ? (
          <>
            {photoSide}
            {videoSide}
          </>
        ) : (
          <>
            {videoSide}
            {photoSide}
          </>
        )}
      </div>

      {/* Embedded Video Quick-Play Overlay (if playing a video without full modal) */}
      {videoPreviewUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 30,
          }}
          onClick={() => setVideoPreviewUrl(null)}
        >
          <div
            style={{
              maxWidth: 960,
              width: '100%',
              backgroundColor: '#0F172A',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
                {selectedVideo?.name || 'Video Preview'}
              </span>
              <button
                onClick={() => setVideoPreviewUrl(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <video
              src={videoPreviewUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '70vh', backgroundColor: '#000' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
