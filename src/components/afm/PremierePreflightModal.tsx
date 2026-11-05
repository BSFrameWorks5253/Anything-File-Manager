import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Play,
  FileSpreadsheet,
  Copy,
  Terminal,
  FolderCheck,
  Search
} from 'lucide-react';
import { formatCumulativeDuration, classifyFolder } from '../../utils/afmTaxonomy';
import { formatBytes } from '../../utils';
import { mediaService } from '../../services';
import { oneTapService } from '../../services/oneTapService';
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

  const isMasterDetected = classification.type === 'master_safar';

  // Mode Selection: Single Date / Slot Mode vs Master Safar Multi-Date Mode
  const [activeMode, setActiveMode] = useState<'single' | 'master'>(isMasterDetected ? 'master' : 'single');

  const defaultProjectName = activeMode === 'master'
    ? `${folderName}_Master.prproj`
    : `${folderName}.prproj`;

  const [projectName, setProjectName] = useState(defaultProjectName);
  const [resolution, setResolution] = useState<'1080p' | '4k'>('1080p');
  const [fps, setFps] = useState<number>(25);
  const [openAfterCreate, setOpenAfterCreate] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [generateManifest, setGenerateManifest] = useState(true);

  // Subfolders & Exclusion List
  const [subfolders, setSubfolders] = useState<SubfolderItem[]>([]);
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);
  const [excludedFolderNames, setExcludedFolderNames] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);

  // Execution State & Terminal Logs
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [copiedPath, setCopiedPath] = useState(false);
  const [resultMsg, setResultMsg] = useState<{
    ok: boolean;
    path?: string;
    xmlPath?: string;
    manifestPath?: string;
    createdCount?: number;
    clipCount?: number;
    error?: string;
  } | null>(null);

  const logConsoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
    }
  }, [logs]);

  // Sync mode and project name when target changes
  useEffect(() => {
    const isM = classification.type === 'master_safar';
    setActiveMode(isM ? 'master' : 'single');
    setProjectName(isM ? `${folderName}_Master.prproj` : `${folderName}.prproj`);
    setResultMsg(null);
    setLogs([]);
    setCurrentStep(1);
  }, [folderName, folderPath, classification.type]);

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

  // Filtered subfolder list
  const filteredSubfolders = useMemo(() => {
    if (!searchFilter.trim()) return subfolders;
    const q = searchFilter.toLowerCase();
    return subfolders.filter(s => s.name.toLowerCase().includes(q));
  }, [subfolders, searchFilter]);

  // Calculate active included clips & size
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

  // Execute sequence creation directly inside AFM using One Tap backend engine
  const handleGenerate = async () => {
    setIsGenerating(true);
    setResultMsg(null);
    setCurrentStep(2);
    setLogs([
      `[INIT] Launching One Tap Premiere Pro Project Generator...`,
      `[MODE] Target Mode: ${activeMode === 'master' ? 'Master Safar Folder Mode' : 'Single Sequence Slot Mode'}`,
      `[TARGET] ${folderPath}`,
      `[SETTINGS] ${resolution.toUpperCase()} @ ${fps} fps | Overwrite: ${overwriteExisting ? 'YES' : 'NO'}`
    ]);

    try {
      setLogs(prev => [...prev, `[SCAN] Checking ${activeMetrics.includedCount} active folders for video media...`]);
      setCurrentStep(3);

      const startTime = performance.now();
      const res = await mediaService.generatePremiereProject({
        folderPath,
        projectName,
        resolution,
        fps,
        openAfterCreate,
        excludedFolders: Array.from(excludedFolderNames),
        mode: activeMode,
        overwriteExisting,
        generateManifest
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (res && res.ok) {
        setCurrentStep(5);
        setLogs(prev => [
          ...prev,
          `[TIMELINE] Synchronized ${res.clipCount || activeMetrics.totalClips} clips onto Track V1/A1 with camera markers.`,
          `[XML] Final Cut Pro XML built: ${res.xmlPath || 'done'}`,
          `[PRPROJ] Universal Adobe Premiere Pro project built: ${res.prprojPath || 'done'}`,
          ...(res.manifestPath ? [`[MANIFEST] Excel reconciliation sheet generated: ${res.manifestPath}`] : []),
          `[DONE] Sequence creation completed successfully in ${elapsed}ms!`
        ]);

        setResultMsg({
          ok: true,
          path: res.prprojPath || res.xmlPath,
          xmlPath: res.xmlPath,
          manifestPath: res.manifestPath,
          createdCount: res.createdCount,
          clipCount: res.clipCount || activeMetrics.totalClips
        });

        if (onSuccess && (res.prprojPath || res.xmlPath)) {
          onSuccess(res.prprojPath || res.xmlPath!);
        }
      } else {
        setCurrentStep(1);
        const errMsg = res?.error || 'Sequence generation failed';
        setLogs(prev => [...prev, `[ERROR] ${errMsg}`]);
        setResultMsg({ ok: false, error: errMsg });
      }
    } catch (err: any) {
      setCurrentStep(1);
      const errMsg = err.message || String(err);
      setLogs(prev => [...prev, `[EXCEPTION] ${errMsg}`]);
      setResultMsg({ ok: false, error: errMsg });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPath = () => {
    if (resultMsg?.path) {
      navigator.clipboard.writeText(resultMsg.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const handleOpenFolder = () => {
    if (resultMsg?.path) {
      mediaService.openInExplorer(resultMsg.path);
    } else {
      mediaService.openInExplorer(folderPath);
    }
  };

  const handleOpenManifest = () => {
    if (resultMsg?.manifestPath) {
      mediaService.openInExplorer(resultMsg.manifestPath);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl mac-card border border-[var(--mac-border)] shadow-2xl flex flex-col overflow-hidden text-[var(--mac-text-primary)] transition-colors max-h-[92vh] bg-[#141622]/95"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Titlebar (macOS Finder + One Tap Companion Header) ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--mac-border)] mac-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold block text-[var(--mac-text-primary)]">
                  Premiere Pro Project & Sequence Creator
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  One Tap Engine
                </span>
              </div>
              <span className="text-[11px] text-[var(--mac-text-secondary)] block">
                Instant in-app project generator • End-to-end V1/A1 placement & timeline markers
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Pill */}
            <div className="flex items-center bg-black/20 dark:bg-black/40 rounded-lg p-0.5 border border-white/10 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('single');
                  setProjectName(`${folderName}.prproj`);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  activeMode === 'single'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-[var(--mac-text-muted)] hover:text-white'
                }`}
              >
                Single / Slot
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMode('master');
                  setProjectName(`${folderName}_Master.prproj`);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  activeMode === 'master'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-[var(--mac-text-muted)] hover:text-white'
                }`}
              >
                Master Safar
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Modal Body Content ── */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Target Folder Scope Header Card */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {activeMode === 'master'
                    ? 'Master Safar Root'
                    : classification.type === 'date_session'
                    ? 'Date Session'
                    : 'Slot Work Folder'}
                </span>
                <span className="text-[11px] font-mono text-[var(--mac-text-secondary)]">
                  {activeMode === 'master' ? 'Multi-Date Batch Creation' : 'Single Sequence Timeline'}
                </span>
              </div>
              <span className="text-xs font-bold text-[var(--mac-text-primary)] block truncate" title={folderName}>
                {folderName}
              </span>
              <span className="text-[10.5px] text-[var(--mac-text-muted)] font-mono block mt-0.5 truncate" title={folderPath}>
                {folderPath}
              </span>
            </div>
            <div className="text-right flex-shrink-0 bg-white/60 dark:bg-black/40 px-3.5 py-2 rounded-xl border border-purple-500/20">
              <span className="text-xs font-black text-purple-400 block font-mono">
                {activeMetrics.totalClips} Clips
              </span>
              {activeMetrics.totalBytes > 0 && (
                <span className="text-[10px] text-[var(--mac-text-muted)] block font-mono">
                  {formatBytes(activeMetrics.totalBytes)}
                </span>
              )}
            </div>
          </div>

          {/* ── Subfolder Exclusions Checklist ── */}
          {subfolders.length > 0 && (
            <div className="space-y-2 border border-[var(--mac-border)] rounded-xl p-3 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mac-text-primary)]">
                  <FolderTree className="w-3.5 h-3.5 text-purple-400" />
                  <span>Subfolder & Camera Angle Inclusions</span>
                  <span className="text-[11px] font-normal text-[var(--mac-text-muted)]">
                    ({activeMetrics.includedCount} of {subfolders.length} included)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExcludeOutputsOnly}
                    className="px-2 py-0.8 rounded text-[10.5px] font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-colors"
                  >
                    Exclude Output Folders
                  </button>
                  <button
                    type="button"
                    onClick={handleIncludeAll}
                    className="px-2 py-0.8 rounded text-[10.5px] font-medium hover:bg-white/10 text-[var(--mac-text-secondary)] transition-colors"
                  >
                    Include All
                  </button>
                  <button
                    type="button"
                    onClick={handleExcludeAll}
                    className="px-2 py-0.8 rounded text-[10.5px] font-medium hover:bg-white/10 text-[var(--mac-text-secondary)] transition-colors"
                  >
                    Exclude All
                  </button>
                </div>
              </div>

              {/* Subfolder Search */}
              {subfolders.length > 6 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="Filter subfolders / camera angles..."
                    className="w-full h-7 pl-8 pr-3 rounded-md bg-black/20 border border-white/10 text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Subfolder Scrollable List */}
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1 border border-white/5 rounded-lg p-1 bg-black/20">
                {filteredSubfolders.map(sf => {
                  const isExcluded = excludedFolderNames.has(sf.name.toLowerCase());
                  return (
                    <div
                      key={sf.name}
                      onClick={() => toggleFolderExclusion(sf.name)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-all ${
                        isExcluded
                          ? 'bg-rose-500/10 text-[var(--mac-text-muted)] opacity-60 line-through'
                          : 'bg-white/[0.04] text-[var(--mac-text-primary)] hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => {}}
                          className="rounded border-gray-400 text-purple-600 focus:ring-purple-500 cursor-pointer pointer-events-none"
                        />
                        <MacFolderIcon size={15} className="flex-shrink-0" />
                        <span className="font-medium truncate max-w-[280px]">{sf.name}</span>
                        {sf.isOutputFolder && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
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

          {/* Project Filename Input */}
          <div>
            <label className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider block mb-1">
              Project & Sequence Filename
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full h-8 px-3 rounded-lg border border-[var(--mac-border)] bg-black/10 dark:bg-white/5 text-xs text-[var(--mac-text-primary)] font-mono focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Sequence Settings: Resolution & Framerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider block mb-1">
                Resolution
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolution('1080p')}
                  className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    resolution === '1080p'
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-xs'
                      : 'border-[var(--mac-border)] text-[var(--mac-text-secondary)] hover:text-white'
                  }`}
                >
                  1080p FHD
                  <span className="block text-[9.5px] font-normal opacity-70">1920 × 1080</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResolution('4k')}
                  className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    resolution === '4k'
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-xs'
                      : 'border-[var(--mac-border)] text-[var(--mac-text-secondary)] hover:text-white'
                  }`}
                >
                  4K UHD
                  <span className="block text-[9.5px] font-normal opacity-70">3840 × 2160</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--mac-text-secondary)] uppercase tracking-wider block mb-1">
                Sequence Framerate
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 29.97].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      fps === rate
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-xs'
                        : 'border-[var(--mac-border)] text-[var(--mac-text-secondary)] hover:text-white'
                    }`}
                  >
                    {rate} fps
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Production Checkboxes */}
          <div className="space-y-1.5 pt-1 text-xs text-[var(--mac-text-secondary)] border-t border-white/10">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openAfterCreate}
                onChange={e => setOpenAfterCreate(e.target.checked)}
                className="rounded border-gray-400 text-purple-600 focus:ring-purple-500"
              />
              <span>Open in Adobe Premiere Pro immediately after creation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={e => setOverwriteExisting(e.target.checked)}
                className="rounded border-gray-400 text-purple-600 focus:ring-purple-500"
              />
              <span>Overwrite existing project files (.prproj / .xml) if present</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={generateManifest}
                onChange={e => setGenerateManifest(e.target.checked)}
                className="rounded border-gray-400 text-purple-600 focus:ring-purple-500"
              />
              <span>Generate Excel reconciliation manifest sheet (Sequence_Manifest.csv)</span>
            </label>
          </div>

          {/* Terminal Console Logs */}
          {logs.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-purple-400" />
                  Generator Terminal
                </span>
                <span className="font-mono text-purple-400">{logs.length} events</span>
              </div>
              <div
                ref={logConsoleRef}
                className="h-28 overflow-y-auto font-mono text-[11px] p-2.5 rounded-lg bg-black/60 border border-white/10 text-gray-300 space-y-1"
              >
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.startsWith('[ERROR]') || l.startsWith('[EXCEPTION]')
                        ? 'text-rose-400 font-bold'
                        : l.startsWith('[SUCCESS]') || l.startsWith('[DONE]')
                        ? 'text-emerald-400 font-bold'
                        : l.startsWith('[INIT]') || l.startsWith('[MODE]')
                        ? 'text-indigo-400 font-bold'
                        : 'text-gray-300'
                    }
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result Alert with Quick Action Buttons */}
          {resultMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2.5 ${
                resultMsg.ok
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {resultMsg.ok ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-bold block text-sm">
                    {resultMsg.ok ? 'Premiere Pro Project Created Successfully!' : 'Generation Error'}
                  </span>
                  <span className="text-[11px] opacity-90 block mt-0.5 font-mono break-all">
                    {resultMsg.path || resultMsg.error}
                  </span>
                </div>
              </div>

              {resultMsg.ok && (
                <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="px-2.5 py-1 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-white font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    Reveal in Explorer
                  </button>
                  {resultMsg.manifestPath && (
                    <button
                      type="button"
                      onClick={handleOpenManifest}
                      className="px-2.5 py-1 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-white font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                      Open Manifest
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    className="px-2.5 py-1 rounded-md bg-black/20 hover:bg-black/40 text-gray-200 font-mono flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedPath ? 'Copied!' : 'Copy Path'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-[var(--mac-border)] mac-header flex items-center justify-between gap-2">
          <div className="text-[11px] font-mono text-[var(--mac-text-muted)]">
            {activeMetrics.totalClips} raw clips selected
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-[var(--mac-border)] hover:bg-white/5 text-xs font-medium text-[var(--mac-text-primary)] transition-colors"
            >
              {resultMsg?.ok ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || activeMetrics.totalClips === 0}
              className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all active:scale-98"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Building Sequence...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>{resultMsg?.ok ? 'Re-Generate Project' : 'Generate Premiere Project'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
