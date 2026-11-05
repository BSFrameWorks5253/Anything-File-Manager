import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  FolderOpen,
  Film,
  HardDrive,
  Calendar,
  Clock,
  FileCode,
  Check,
  Tag,
  Maximize2,
  ExternalLink,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  formatBytes,
  formatDate,
  formatTimelapse,
  isPhotoExtension,
  isVideoExtension,
  isRawExtension
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { MacFolderIcon, MacDocumentIcon } from '../common/MacIcons';
import { classifyFolder, PRODUCTION_STAGES, ProductionStage } from '../../utils/afmTaxonomy';

interface PropertiesModalProps {
  item: FsItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPlayer?: (item: FsItem) => void;
}

export const PropertiesModal: React.FC<PropertiesModalProps> = ({
  item,
  isOpen,
  onClose,
  onOpenPlayer
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'details' | 'production'>('general');
  const [copied, setCopied] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [afmStats, setAfmStats] = useState<any>(null);
  const [loadingAfm, setLoadingAfm] = useState(false);
  const [stage, setStage] = useState<ProductionStage>('stage1');
  const [titleAdderFeedback, setTitleAdderFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!item || !isOpen) return;
    setThumb(null);
    setDuration(0);
    setAfmStats(null);
    setTitleAdderFeedback(null);

    const isVid = isVideoExtension(item.ext);
    const isRaw = isRawExtension(item.ext);

    if (isVid || isRaw) {
      const cached = thumbnailService.getCached(item.fullPath);
      if (cached && cached.thumb) {
        setThumb(cached.thumb);
        setDuration(cached.duration);
      } else {
        thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
          if (res && res.thumb) {
            setThumb(res.thumb);
            setDuration(res.duration);
          }
        });
        if (isRaw) {
          mediaService.readImageBase64(item.fullPath).then(res => {
            if (res.ok && res.dataUrl) setThumb(res.dataUrl);
          });
        }
      }
    }

    if (item.isDir) {
      setLoadingAfm(true);
      mediaService.analyzeAfmFolder(item.fullPath).then(res => {
        setAfmStats(res);
        if (res?.currentStage) setStage(res.currentStage);
        setLoadingAfm(false);
      }).catch(() => setLoadingAfm(false));
    }
  }, [item?.fullPath, isOpen]);

  if (!isOpen || !item) return null;

  const classification = item.isDir ? classifyFolder(item.name, item.fullPath) : null;
  const isVid = isVideoExtension(item.ext);
  const isImg = isPhotoExtension(item.ext);
  const isRaw = isRawExtension(item.ext);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.fullPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStageChange = async (newStage: ProductionStage) => {
    setStage(newStage);
    await mediaService.setAfmStage(item.fullPath, newStage);
  };

  const handleSendToTitleAdder = async () => {
    setTitleAdderFeedback('Sending to Title Adder...');
    const res = await mediaService.sendToTitleAdder(item.fullPath);
    if (res.ok) {
      setTitleAdderFeedback('Loaded into Title Adder (Port 49152)!');
    } else {
      setTitleAdderFeedback(res.error || 'Failed to connect. Start One Tap first.');
    }
    setTimeout(() => setTitleAdderFeedback(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#161823] border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-100 select-none animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Dialog Header with Traffic Light & Tabs ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08] mac-header">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wide">
              {item.name} Properties
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs Selector ── */}
        <div className="flex items-center px-4 pt-2 border-b border-black/[0.06] dark:border-white/[0.06] gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-2 px-1 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-[var(--mac-accent)] text-[var(--mac-accent)] font-bold'
                : 'border-transparent text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
            }`}
          >
            General
          </button>
          {(isVid || isImg || isRaw) && (
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2 px-1 border-b-2 transition-all ${
                activeTab === 'details'
                  ? 'border-[var(--mac-accent)] text-[var(--mac-accent)] font-bold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
              }`}
            >
              Media Details
            </button>
          )}
          {item.isDir && (
            <button
              onClick={() => setActiveTab('production')}
              className={`pb-2 px-1 border-b-2 transition-all ${
                activeTab === 'production'
                  ? 'border-[var(--mac-accent)] text-[var(--mac-accent)] font-bold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
              }`}
            >
              Production AFM
            </button>
          )}
        </div>

        {/* ── Tab Content ── */}
        <div className="p-4 flex-1 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
          {activeTab === 'general' && (
            <>
              {/* Item Header Banner */}
              <div className="flex items-center gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
                  {item.isDir ? (
                    <MacFolderIcon size={60} />
                  ) : thumb ? (
                    <img src={thumb} alt={item.name} className="max-h-16 max-w-16 object-contain rounded-lg shadow-sm" />
                  ) : (
                    <MacDocumentIcon size={56} ext={item.ext} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold truncate text-[var(--mac-text-primary)]" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-[var(--mac-text-muted)] mt-0.5">
                    {item.isDir ? 'File folder' : `${(item.ext || '').toUpperCase()} File`}
                  </p>
                </div>
              </div>

              {/* General Metadata Rows */}
              <div className="space-y-2.5 text-[11.5px]">
                <div className="flex items-start">
                  <span className="w-28 text-[var(--mac-text-muted)] font-medium">Type:</span>
                  <span className="flex-1 font-semibold text-[var(--mac-text-primary)]">
                    {item.isDir ? 'Folder / Directory' : `${item.ext.toUpperCase()} document`}
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="w-28 text-[var(--mac-text-muted)] font-medium">Location:</span>
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="font-mono text-[11px] truncate text-[var(--mac-text-secondary)]" title={item.fullPath}>
                      {item.fullPath}
                    </span>
                    <button
                      onClick={handleCopyPath}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[var(--mac-accent)] flex-shrink-0"
                      title="Copy Full Path"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="w-28 text-[var(--mac-text-muted)] font-medium">Size:</span>
                  <span className="flex-1 font-mono text-[var(--mac-text-primary)]">
                    {item.isDir
                      ? afmStats ? `${formatBytes(afmStats.totalSizeBytes ?? 0)} (${(afmStats.totalSizeBytes ?? 0).toLocaleString()} bytes)` : 'Calculating...'
                      : `${formatBytes(item.size ?? 0)} (${(item.size ?? 0).toLocaleString()} bytes)`}
                  </span>
                </div>

                {item.isDir && afmStats && (
                  <div className="flex items-start">
                    <span className="w-28 text-[var(--mac-text-muted)] font-medium">Contains:</span>
                    <span className="flex-1 text-[var(--mac-text-secondary)]">
                      {afmStats.totalFilesCount || 0} files, {afmStats.slots?.length || 0} slots ({afmStats.videoFilesCount || 0} video clips)
                    </span>
                  </div>
                )}

                <div className="flex items-start pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <span className="w-28 text-[var(--mac-text-muted)] font-medium">Modified:</span>
                  <span className="flex-1 font-mono text-[var(--mac-text-secondary)]">
                    {formatDate(item.mtime)}
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="w-28 text-[var(--mac-text-muted)] font-medium">Attributes:</span>
                  <span className="flex-1 text-[var(--mac-text-secondary)]">
                    {item.isHidden ? 'Hidden' : 'Standard Normal'}
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'details' && (
            <div className="space-y-3">
              {isVid && (
                <>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-amber-600 dark:text-amber-400">Video Duration</span>
                    </div>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-300">
                      {duration > 0 ? formatTimelapse(duration) : 'Reading metadata...'}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11.5px] pt-2">
                    <div className="flex items-start">
                      <span className="w-28 text-[var(--mac-text-muted)]">Format:</span>
                      <span className="flex-1 uppercase font-bold text-[var(--mac-text-primary)]">{item.ext}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="w-28 text-[var(--mac-text-muted)]">Playback:</span>
                      <span className="flex-1 text-[var(--mac-text-secondary)]">Hardware Accelerated (GPU NVENC/DXVA2)</span>
                    </div>
                  </div>
                </>
              )}

              {(isImg || isRaw) && (
                <div className="space-y-2 text-[11.5px]">
                  <div className="flex items-start">
                    <span className="w-28 text-[var(--mac-text-muted)]">Image Type:</span>
                    <span className="flex-1 font-bold text-[var(--mac-text-primary)]">
                      {isRaw ? 'Camera RAW Master Capture' : 'Standard Digital Image'}
                    </span>
                  </div>
                  <div className="flex items-start">
                    <span className="w-28 text-[var(--mac-text-muted)]">Inspection:</span>
                    <span className="flex-1 text-[var(--mac-text-secondary)]">Frame Zoom & Pixel Inspection Supported</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'production' && item.isDir && (
            <div className="space-y-3">
              {/* Classification Banner */}
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">AFM Hierarchy</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-300 capitalize mt-0.5">
                    {classification?.type.replace('_', ' ')}
                  </p>
                </div>
                {classification?.slotTokens?.session && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono font-bold text-[10px]">
                    {classification.slotTokens.session}
                  </span>
                )}
              </div>

              {/* Cumulative Runtime */}
              {afmStats && (
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--mac-text-muted)] font-medium">Cumulative Runtime:</span>
                    <span className="font-mono font-bold text-amber-500 text-sm">
                      {afmStats.cumulativeDurationFormatted || '00:00:00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--mac-text-muted)]">Total Storage Size:</span>
                    <span className="font-mono">{formatBytes(afmStats.totalSizeBytes)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--mac-text-muted)]">Raw Video Clips:</span>
                    <span className="font-mono">{afmStats.videoFilesCount} clips</span>
                  </div>
                </div>
              )}

              {/* Stage Selector */}
              <div className="space-y-1.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                <label className="text-[11px] font-semibold text-[var(--mac-text-muted)]">Workflow Stage Tag:</label>
                <select
                  value={stage}
                  onChange={e => handleStageChange(e.target.value as ProductionStage)}
                  className="w-full bg-black/5 dark:bg-neutral-800 border border-black/10 dark:border-white/10 rounded-lg p-2 text-xs font-semibold outline-none text-[var(--mac-text-primary)]"
                >
                  {Object.values(PRODUCTION_STAGES).map(st => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* One Tap Title Adder Bridge Action */}
              <div className="pt-2">
                <button
                  onClick={handleSendToTitleAdder}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Send to One Tap Title Adder (Port 49152)</span>
                </button>
                {titleAdderFeedback && (
                  <p className="text-[11px] text-center font-medium text-emerald-500 mt-1">
                    {titleAdderFeedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div className="px-4 py-3 border-t border-black/[0.08] dark:border-white/[0.08] mac-header flex items-center justify-between gap-2">
          <button
            onClick={() => mediaService.openInExplorer(item.fullPath)}
            className="py-1.5 px-3 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--mac-text-primary)] font-semibold flex items-center gap-1.5 transition-colors border border-[var(--mac-border)]"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Show in Explorer</span>
          </button>

          <div className="flex items-center gap-2">
            {!item.isDir && onOpenPlayer && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPlayer(item);
                }}
                className="py-1.5 px-3 rounded-lg bg-[var(--mac-accent)] text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Open Player</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="py-1.5 px-4 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 text-[var(--mac-text-primary)] font-semibold transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
