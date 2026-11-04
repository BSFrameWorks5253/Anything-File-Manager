import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Sliders,
  Check,
  RefreshCw,
  Folder,
  FolderMinus,
  Sparkles,
  Zap,
  Play
} from 'lucide-react';
import { formatCumulativeDuration, classifyFolder } from '../../utils/afmTaxonomy';
import { formatBytes } from '../../utils';
import { mediaService } from '../../services';
import { MacFolderIcon } from '../common/MacIcons';

interface SubfolderItem {
  name: string;
  relPath: string;
  fullPath: string;
  clipCount: number;
  photoCount: number;
  totalBytes: number;
  isOutputFolder: boolean;
  defaultExcluded: boolean;
}

interface PremierePreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  folderName: string;
  folderType?: string;
  videoClipCount?: number;
  cumulativeDuration?: number;
  onSuccess?: (projectPath: string) => void;
}

export const PremierePreflightModal: React.FC<PremierePreflightModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  folderName,
  folderType,
  videoClipCount: initialClipCount = 0,
  cumulativeDuration: initialDuration = 0,
  onSuccess
}) => {
  const classification = useMemo(() => {
    return classifyFolder(folderName, folderPath);
  }, [folderName, folderPath]);

  const isMaster = classification.type === 'master_safar';
  const defaultProjectName = isMaster
    ? `${folderName}_Master.prproj`
    : `${folderName}.prproj`;

  const [projectName, setProjectName] = useState(defaultProjectName);
  const [resolution, setResolution] = useState<'1080p' | '4k'>('1080p');
  const [fps, setFps] = useState<number>(25);
  const [openAfterCreate, setOpenAfterCreate] = useState(true);

  // Subfolders & Exclusion List
  const [subfolders, setSubfolders] = useState<SubfolderItem[]>([]);
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);
  const [excludedFolderNames, setExcludedFolderNames] = useState<Set<string>>(new Set());
  const [analytics, setAnalytics] = useState<any>(null);

  // Execution State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; path?: string; error?: string } | null>(null);
  const [oneTapLaunchStatus, setOneTapLaunchStatus] = useState<string | null>(null);

  // Sync default project name when target changes
  useEffect(() => {
    setProjectName(defaultProjectName);
    setResultMsg(null);
    setOneTapLaunchStatus(null);
  }, [defaultProjectName, folderPath]);

  // Load subfolders for preflight exclusion
  const loadSubfolders = useCallback(async () => {
    if (!folderPath) return;
    setLoadingSubfolders(true);
    try {
      const [res, afmData] = await Promise.all([
        mediaService.getSubfoldersPreflight(folderPath),
        mediaService.analyzeAfmFolder(folderPath)
      ]);

      if (afmData) {
        setAnalytics(afmData);
      }

      if (res && res.ok && Array.isArray(res.subfolders)) {
        setSubfolders(res.subfolders);
        // Exclude output folders by default
        const initExcluded = new Set<string>();
        for (const sf of res.subfolders) {
          if (sf.defaultExcluded || sf.isOutputFolder) {
            initExcluded.add(sf.name.toLowerCase());
          }
        }
        setExcludedFolderNames(initExcluded);
      } else {
        setSubfolders([]);
      }
    } catch (err) {
      console.warn('[PremierePreflightModal] Subfolders preflight note:', err);
    } finally {
      setLoadingSubfolders(false);
    }
  }, [folderPath]);

  useEffect(() => {
    if (isOpen) {
      loadSubfolders();
    }
  }, [isOpen, loadSubfolders]);

  // Toggle single folder exclusion
  const toggleFolderExclusion = (name: string) => {
    const lower = name.toLowerCase();
    setExcludedFolderNames(prev => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  };

  // Exclude all output/render folders
  const handleExcludeOutputsOnly = () => {
    const next = new Set<string>();
    for (const sf of subfolders) {
      if (sf.isOutputFolder) next.add(sf.name.toLowerCase());
    }
    setExcludedFolderNames(next);
  };

  // Include all
  const handleIncludeAll = () => {
    setExcludedFolderNames(new Set());
  };

  // Exclude all subfolders
  const handleExcludeAll = () => {
    const next = new Set<string>();
    for (const sf of subfolders) {
      next.add(sf.name.toLowerCase());
    }
    setExcludedFolderNames(next);
  };

  // Calculate active included clips & size (Unconditionally called hook)
  const activeMetrics = useMemo(() => {
    let totalClips = 0;
    let totalBytes = 0;
    let includedCount = 0;

    if (subfolders.length > 0) {
      for (const sf of subfolders) {
        if (!excludedFolderNames.has(sf.name.toLowerCase())) {
          totalClips += sf.clipCount;
          totalBytes += sf.totalBytes;
          includedCount++;
        }
      }
    }

    // Ensure we don't undercount if analytics found clips in camera structures or root
    if (analytics && analytics.videoClipCount > 0) {
      if (totalClips === 0 || subfolders.length === 0) {
        totalClips = analytics.videoClipCount;
        totalBytes = analytics.totalStorageBytes || 0;
      }
    } else if (totalClips === 0 && initialClipCount) {
      totalClips = initialClipCount;
    }

    return { totalClips, totalBytes, includedCount, totalSubfolders: subfolders.length };
  }, [subfolders, excludedFolderNames, analytics, initialClipCount]);

  if (!isOpen) return null;

  // Execute sequence creation using One Tap Engine
  const handleGenerate = async () => {
    setIsGenerating(true);
    setResultMsg(null);
    setGenerationStep('Scanning media assets and filtering exclusions...');

    try {
      setGenerationStep('Probing frame-accurate stream timecodes & framerates...');
      const res = await mediaService.generatePremiereProject({
        folderPath,
        projectName,
        resolution,
        fps,
        openAfterCreate,
        excludedFolders: Array.from(excludedFolderNames)
      });

      if (res && res.ok) {
        setGenerationStep('Generated synchronized .prproj & Final Cut Pro XML!');
        setResultMsg({ ok: true, path: res.prprojPath || res.xmlPath });
        if (onSuccess && (res.prprojPath || res.xmlPath)) {
          onSuccess(res.prprojPath || res.xmlPath!);
        }
      } else {
        setResultMsg({ ok: false, error: res?.error || 'Sequence creation failed' });
      }
    } catch (err: any) {
      setResultMsg({ ok: false, error: err.message || String(err) });
    } finally {
      setIsGenerating(false);
    }
  };

  // Launch One Tap Desktop App explicitly
  const handleLaunchOneTapApp = async () => {
    setOneTapLaunchStatus('Launching One Tap Production Suite...');
    try {
      const res = await mediaService.openOneTap(folderPath);
      if (res && res.ok) {
        setOneTapLaunchStatus('One Tap app opened successfully!');
      } else {
        setOneTapLaunchStatus(res?.error || 'Could not locate One Tap application');
      }
    } catch (err: any) {
      setOneTapLaunchStatus(err.message || 'Launch error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl mac-card border border-[var(--mac-border)] shadow-2xl flex flex-col overflow-hidden text-[var(--mac-text-primary)] transition-colors max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Titlebar (macOS Style) ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--mac-border)] mac-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold block text-[var(--mac-text-primary)]">
                  One Tap Sequence Maker & Preflight
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  One Tap Engine
                </span>
              </div>
              <span className="text-[11.5px] text-[var(--mac-text-secondary)] block">
                Automatic timeline sequence builder with folder exclusions & frame sync
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

        {/* ── Modal Body Content ── */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Target Folder Taxonomy Scope */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  {isMaster ? 'Master Safar Root' : classification.type === 'date_session' ? 'Date Session Folder' : 'Slot Work Folder'}
                </span>
                {classification.sessionCode && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                    {classification.sessionCode}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-[var(--mac-text-primary)] block truncate">
                {folderName}
              </span>
              <span className="text-[11px] text-[var(--mac-text-muted)] font-mono block mt-0.5 truncate">
                {folderPath}
              </span>
            </div>
            <div className="text-right flex-shrink-0 bg-white/60 dark:bg-black/40 px-3 py-2 rounded-lg border border-purple-500/20">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-300 block">
                {activeMetrics.totalClips} Video Clips
              </span>
              {activeMetrics.totalBytes > 0 && (
                <span className="text-[10.5px] text-[var(--mac-text-muted)] block font-mono">
                  {formatBytes(activeMetrics.totalBytes)}
                </span>
              )}
            </div>
          </div>

          {/* ── Subfolder Exclusions Checklist ── */}
          {subfolders.length > 0 && (
            <div className="space-y-2 border border-[var(--mac-border)] rounded-xl p-3 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mac-text-primary)]">
                  <FolderTree className="w-3.5 h-3.5 text-purple-500" />
                  <span>Subfolder Inclusions & Exclusions</span>
                  <span className="text-[11px] font-normal text-[var(--mac-text-muted)]">
                    ({activeMetrics.includedCount} of {subfolders.length} included)
                  </span>
                </div>
                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExcludeOutputsOnly}
                    className="px-2 py-0.8 rounded text-[10.5px] font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-colors"
                    title="Automatically exclude renders, exports, proxy, and temp folders"
                  >
                    Exclude Output Folders
                  </button>
                  <button
                    type="button"
                    onClick={handleIncludeAll}
                    className="px-2 py-0.8 rounded text-[10.5px] font-medium hover:bg-black/5 dark:hover:bg-white/10 text-[var(--mac-text-secondary)] transition-colors"
                  >
                    Include All
                  </button>
                  <button
                    type="button"
                    onClick={handleExcludeAll}
                    className="px-2 py-0.8 rounded text-[10.5px] font-medium hover:bg-black/5 dark:hover:bg-white/10 text-[var(--mac-text-secondary)] transition-colors"
                  >
                    Exclude All
                  </button>
                </div>
              </div>

              {/* Subfolder Scrollable List */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-black/5 dark:border-white/5 rounded-lg p-1 bg-white/50 dark:bg-black/20">
                {subfolders.map(sf => {
                  const isExcluded = excludedFolderNames.has(sf.name.toLowerCase());
                  return (
                    <div
                      key={sf.name}
                      onClick={() => toggleFolderExclusion(sf.name)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-all ${
                        isExcluded
                          ? 'bg-rose-500/10 text-[var(--mac-text-muted)] opacity-60 line-through'
                          : 'bg-black/[0.03] dark:bg-white/[0.04] text-[var(--mac-text-primary)] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => {}} // Controlled by row click
                          className="rounded border-gray-400 text-purple-600 focus:ring-purple-500 cursor-pointer pointer-events-none"
                        />
                        <MacFolderIcon size={15} className="flex-shrink-0" />
                        <span className="font-medium truncate max-w-[240px]">{sf.name}</span>
                        {sf.isOutputFolder && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                            Output / Render
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--mac-text-muted)] flex-shrink-0">
                        <span>{sf.clipCount} {sf.clipCount === 1 ? 'clip' : 'clips'}</span>
                        {sf.totalBytes > 0 && <span>{formatBytes(sf.totalBytes)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project Filename */}
          <div>
            <label className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider block mb-1.5">
              Project & Sequence Filename
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-[var(--mac-border)] bg-black/5 dark:bg-white/5 text-xs text-[var(--mac-text-primary)] font-mono focus:outline-none focus:border-[var(--mac-accent)] transition-colors"
            />
          </div>

          {/* Sequence Settings: Resolution & Framerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider block mb-1.5">
                Resolution
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolution('1080p')}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                    resolution === '1080p'
                      ? 'border-purple-500 bg-purple-500/15 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'border-[var(--mac-border)] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
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
                      ? 'border-purple-500 bg-purple-500/15 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'border-[var(--mac-border)] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
                  }`}
                >
                  4K UHD
                  <span className="block text-[9.5px] font-normal opacity-70">3840 × 2160</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider block mb-1.5">
                Sequence Framerate
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 29.97].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                      fps === rate
                        ? 'border-purple-500 bg-purple-500/15 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'border-[var(--mac-border)] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
                    }`}
                  >
                    {rate} fps
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Standard Bins Structure Visualizer */}
          <div className="p-3 rounded-xl border border-[var(--mac-border)] mac-header space-y-2">
            <span className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-purple-500" />
              Standard Production Bins Structure
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--mac-text-secondary)]">
              <div className="flex items-center gap-1.5">
                <span>📁</span> 01 ROUGH CUTS
              </div>
              <div className="flex items-center gap-1.5">
                <span>📁</span> 02 AUDIO & VO
              </div>
              <div className="flex items-center gap-1.5">
                <span>📁</span> 03 TITLES & GRAPHICS
              </div>
              <div className="flex items-center gap-1.5">
                <span>📁</span> 04 CAMERA FOOTAGE
              </div>
            </div>
          </div>

          {/* Options & One Tap Engine Note */}
          <div className="flex items-center justify-between text-xs text-[var(--mac-text-secondary)] pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openAfterCreate}
                onChange={e => setOpenAfterCreate(e.target.checked)}
                className="rounded border-gray-400 text-purple-600 focus:ring-purple-500"
              />
              <span>Open in Adobe Premiere Pro immediately after creation</span>
            </label>
          </div>

          {/* Generation Step Indicator */}
          {isGenerating && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center gap-3 text-xs text-purple-700 dark:text-purple-300 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
              <span className="font-medium">{generationStep}</span>
            </div>
          )}

          {/* Result Alert */}
          {resultMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                resultMsg.ok
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300'
              }`}
            >
              {resultMsg.ok ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              )}
              <div className="min-w-0">
                <span className="font-bold block">
                  {resultMsg.ok ? 'Premiere Pro Sequence Created Successfully!' : 'Generation Error'}
                </span>
                <span className="text-[11px] opacity-90 block mt-0.5 font-mono break-all">
                  {resultMsg.path || resultMsg.error}
                </span>
              </div>
            </div>
          )}

          {/* One Tap Launch Feedback */}
          {oneTapLaunchStatus && (
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span>{oneTapLaunchStatus}</span>
              <button
                type="button"
                onClick={() => setOneTapLaunchStatus(null)}
                className="text-blue-500 hover:text-blue-400 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-[var(--mac-border)] mac-header flex items-center justify-between gap-2">
          {/* Left: Open in One Tap App button */}
          <button
            type="button"
            onClick={handleLaunchOneTapApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--mac-border)] hover:bg-black/5 dark:hover:bg-white/5 text-xs text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] transition-colors"
            title="Open the standalone One Tap desktop application"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
            <span>Open in One Tap App</span>
          </button>

          {/* Right: Cancel + Generate */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-[var(--mac-border)] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium text-[var(--mac-text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || activeMetrics.totalClips === 0}
              className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all active:scale-98"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Building Sequences...' : 'Generate Sequences'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
