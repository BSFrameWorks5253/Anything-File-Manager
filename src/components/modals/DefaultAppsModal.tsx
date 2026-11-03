import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { mediaService } from '../../services';

interface DefaultAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DefaultAppsModal: React.FC<DefaultAppsModalProps> = ({ isOpen, onClose }) => {
  const [includeVideos, setIncludeVideos] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [isVideoDefault, setIsVideoDefault] = useState(false);
  const [isPhotoDefault, setIsPhotoDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const checkStatus = async () => {
    const status = await mediaService.checkDefaultStatus();
    setIsVideoDefault(status.isVideoDefault);
    setIsPhotoDefault(status.isPhotoDefault);
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = async () => {
    setLoading(true);
    setFeedback(null);
    const categories: ('videos' | 'photos')[] = [];
    if (includeVideos) categories.push('videos');
    if (includePhotos) categories.push('photos');

    if (categories.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one media category (videos or photos).' });
      setLoading(false);
      return;
    }

    const res = await mediaService.registerDefaultViewer(categories);
    if (res.ok) {
      setFeedback({
        type: 'success',
        message: `Successfully registered MediaView Studio as Windows default for ${res.registeredCount || 0} formats! Windows File Explorer thumbnails are now active.`
      });
      await checkStatus();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update registry associations.' });
    }
    setLoading(false);
  };

  const handleRestore = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await mediaService.unregisterDefaultViewer();
    if (res.ok) {
      setFeedback({ type: 'success', message: 'Restored Windows defaults and unregistered custom associations.' });
      await checkStatus();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to restore defaults.' });
    }
    setLoading(false);
  };

  const handleOpenSettings = async () => {
    await mediaService.openWindowsDefaultAppsSettings();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#141622] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#181b2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Windows Default Viewer & Thumbnails
              </h2>
              <p className="text-xs text-indigo-300">
                Native Windows File Explorer Shell Integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-sm">
          <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>
              Setting MediaView Studio as the default viewer registers the native Windows Shell
              Thumbnail Providers for all media types. Windows File Explorer will display real
              thumbnail previews for all videos and photos, and open them in MediaView Studio when
              double-clicked.
            </span>
          </div>

          {/* Category Selectors */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Choose Media Categories to Associate:
            </label>

            {/* Video Option */}
            <div
              onClick={() => setIncludeVideos(!includeVideos)}
              className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                includeVideos
                  ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <Film className={`w-5 h-5 ${includeVideos ? 'text-indigo-400' : 'text-gray-500'}`} />
                <div>
                  <div className="font-semibold text-sm">Video Media Formats</div>
                  <div className="text-[11px] text-gray-400">
                    .mp4, .mov, .mkv, .avi, .webm, .ts, .wmv, .flv, .m4v
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isVideoDefault && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Active Default
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={includeVideos}
                  onChange={() => {}}
                  className="accent-indigo-500 w-4 h-4"
                />
              </div>
            </div>

            {/* Photo Option */}
            <div
              onClick={() => setIncludePhotos(!includePhotos)}
              className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                includePhotos
                  ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <ImageIcon className={`w-5 h-5 ${includePhotos ? 'text-pink-400' : 'text-gray-500'}`} />
                <div>
                  <div className="font-semibold text-sm">Photo & Image Formats</div>
                  <div className="text-[11px] text-gray-400">
                    .jpg, .jpeg, .png, .webp, .gif, .bmp, .svg, .avif, .tiff, .cr2, .nef, .arw
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isPhotoDefault && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Active Default
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={includePhotos}
                  onChange={() => {}}
                  className="accent-indigo-500 w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#11131c]">
          <button
            onClick={handleRestore}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-white hover:underline disabled:opacity-50"
          >
            Restore Windows Defaults
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl border border-white/10"
              title="Open Windows Default Apps Settings"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Windows Settings</span>
            </button>
            <button
              onClick={handleApply}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Apply & Set as Default</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
