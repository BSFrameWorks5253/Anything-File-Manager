import React from 'react';
import { ZoomIn, ZoomOut, RotateCw, Camera, X, Clock } from 'lucide-react';
import { FsItem } from '../../types';
import { formatBytes, formatTimelapse } from '../../utils';

interface ViewerToolbarProps {
  item: FsItem;
  isVideo: boolean;
  isPhoto: boolean;
  duration: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onRotatePhoto?: () => void;
  onCaptureSnapshot?: () => void;
  snapshotFeedback?: string | null;
  onClose: () => void;
}

export const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
  item,
  isVideo,
  isPhoto,
  duration,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onRotatePhoto,
  onCaptureSnapshot,
  snapshotFeedback,
  onClose
}) => {
  return (
    <div
      className="flex items-center justify-between px-5 py-3 bg-[#11131c]/90 border-b border-white/10"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-white max-w-lg truncate">{item.name}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
          {formatBytes(item.size)}
        </span>
        {isVideo && duration > 0 && (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5 shadow-md">
            <Clock className="w-3.5 h-3.5" />
            <span>Timelapse: {formatTimelapse(duration)}</span>
          </span>
        )}
      </div>

      {/* Center Zoom Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={onZoomOut}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-indigo-300 w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {zoom > 1 && (
            <button
              onClick={onResetZoom}
              className="text-xs font-bold text-amber-400 px-2 py-1 hover:bg-white/10 rounded-lg"
              title="Reset Zoom to Fit"
            >
              Fit / 100%
            </button>
          )}
        </div>

        {/* Photo Rotation */}
        {isPhoto && onRotatePhoto && (
          <button
            onClick={onRotatePhoto}
            className="p-2 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white border border-white/10"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}

        {/* Video Snapshot Button */}
        {isVideo && onCaptureSnapshot && (
          <button
            onClick={onCaptureSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-xl hover:scale-105 transition-all"
            title="Capture & Save High-Res Frame Snapshot"
          >
            <Camera className="w-4 h-4" />
            <span>Snapshot</span>
          </button>
        )}

        {snapshotFeedback && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            {snapshotFeedback}
          </span>
        )}

        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white ml-2"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
