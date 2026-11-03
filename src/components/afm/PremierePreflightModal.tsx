import React, { useState } from 'react';
import {
  X,
  Film,
  Layers,
  Clock,
  HardDrive,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sliders
} from 'lucide-react';
import { formatCumulativeDuration } from '../../utils/afmTaxonomy';
import { mediaService } from '../../services';

interface PremierePreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  folderName: string;
  folderType: string;
  videoClipCount: number;
  cumulativeDuration: number;
  onSuccess?: (projectPath: string) => void;
}

export const PremierePreflightModal: React.FC<PremierePreflightModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  folderName,
  folderType,
  videoClipCount,
  cumulativeDuration,
  onSuccess
}) => {
  const isMaster = folderType === 'master_safar';
  const defaultProjectName = isMaster
    ? `${folderName}_Master.prproj`
    : `${folderName}.prproj`;

  const [projectName, setProjectName] = useState(defaultProjectName);
  const [resolution, setResolution] = useState<'1080p' | '4k'>('1080p');
  const [fps, setFps] = useState<number>(25);
  const [openAfterCreate, setOpenAfterCreate] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; path?: string; error?: string } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResultMsg(null);
    try {
      const res = await mediaService.generatePremiereProject({
        folderPath,
        projectName,
        resolution,
        fps,
        openAfterCreate
      });
      if (res && res.ok) {
        setResultMsg({ ok: true, path: res.prprojPath || res.xmlPath });
        if (onSuccess && (res.prprojPath || res.xmlPath)) {
          onSuccess(res.prprojPath || res.xmlPath!);
        }
      } else {
        setResultMsg({ ok: false, error: res?.error || 'Project creation failed' });
      }
    } catch (err: any) {
      setResultMsg({ ok: false, error: err.message || String(err) });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl mac-card border mac-border shadow-2xl flex flex-col overflow-hidden text-[var(--mac-text-primary)] transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b mac-border mac-header">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold block">Adobe Premiere Pro Pre-Flight</span>
              <span className="text-[11px] mac-text-secondary block">
                Sequence & Project File Generator
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Scope Banner */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-purple-400 uppercase tracking-wider block">
                Target Folder Scope
              </span>
              <span className="text-xs font-semibold text-[var(--mac-text-primary)] block mt-0.5">
                {isMaster ? 'Master Safar Multi-Date Scope' : 'Date Session Work Folder'}
              </span>
              <span className="text-[11px] text-[var(--mac-text-secondary)] font-mono block mt-0.5 truncate max-w-md">
                {folderPath}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xs font-bold text-purple-300 block">{videoClipCount} Clips</span>
              <span className="text-[10.5px] text-[var(--mac-text-muted)] block">
                {formatCumulativeDuration(cumulativeDuration)}
              </span>
            </div>
          </div>

          {/* Project Filename */}
          <div>
            <label className="text-xs font-bold mac-text-secondary uppercase tracking-wider block mb-1.5">
              Project / Sequence File Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border mac-border bg-black/5 dark:bg-white/5 text-xs text-[var(--mac-text-primary)] font-mono focus:outline-none focus:border-[var(--mac-accent)] transition-colors"
            />
          </div>

          {/* Sequence Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mac-text-secondary uppercase tracking-wider block mb-1.5">
                Resolution
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolution('1080p')}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                    resolution === '1080p'
                      ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                      : 'mac-border mac-text-secondary hover:mac-text-primary'
                  }`}
                >
                  1080p FHD
                  <span className="block text-[9.5px] font-normal opacity-70">1920 × 1080</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResolution('4k')}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                    resolution === '4k'
                      ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                      : 'mac-border mac-text-secondary hover:mac-text-primary'
                  }`}
                >
                  4K UHD
                  <span className="block text-[9.5px] font-normal opacity-70">3840 × 2160</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold mac-text-secondary uppercase tracking-wider block mb-1.5">
                Timebase / Framerate
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 29.97].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                      fps === rate
                        ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                        : 'mac-border mac-text-secondary hover:mac-text-primary'
                    }`}
                  >
                    {rate} fps
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Template Bins Layout */}
          <div className="p-3.5 rounded-xl border mac-border mac-header space-y-2">
            <span className="text-[11px] font-bold mac-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-purple-400" />
              Standard Production Bins Structure
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--mac-text-secondary)]">
              <div className="flex items-center gap-1.5">
                <span className="text-purple-400">📁</span> 01 ROUGH CUTS
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400">📁</span> 02 AUDIO & VO
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-cyan-400">📁</span> 03 TITLES & GRAPHICS
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">📁</span> 04 CAMERA FOOTAGE
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between text-xs mac-text-secondary">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openAfterCreate}
                onChange={e => setOpenAfterCreate(e.target.checked)}
                className="rounded border-gray-400 text-purple-600 focus:ring-purple-500"
              />
              <span>Open in Adobe Premiere Pro immediately after generation</span>
            </label>
          </div>

          {/* Result Alert */}
          {resultMsg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                resultMsg.ok
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {resultMsg.ok ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              )}
              <div>
                <span className="font-bold block">
                  {resultMsg.ok ? 'Project Created Successfully!' : 'Generation Error'}
                </span>
                <span className="text-[11px] opacity-90 block mt-0.5 font-mono break-all">
                  {resultMsg.path || resultMsg.error}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t mac-border mac-header flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border mac-border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || videoClipCount === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Film className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Building Project...' : 'Generate Project File'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
