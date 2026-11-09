import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import prLogo from '../../assets/pr_logo.png';
import './PrprojGenerator.css';

interface CameramanFolderInfo {
  name: string;
  path: string;
  markerName?: string;
  markerDescription?: string;
  markerColor?: {
    name?: string;
    red: number;
    green: number;
    blue: number;
  };
  videoCount: number;
}

interface SubfolderItem {
  name: string;
  path: string;
  hasPrproj: boolean;
  prprojPath?: string;
  videoCount?: number;
  isOutputFolder?: boolean;
}

interface ManifestStats {
  totalFiles: number;
  totalFolders: number;
  folderName: string;
  excelPath: string;
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

// ── Web Audio Synthesizer Tones (100% Matching One Tap Engine) ──
function useSynthesizerAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {}
    return audioCtxRef.current;
  };

  const playTick = useCallback(() => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.003, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {}
  }, []);

  const playSuccess = useCallback(() => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = ctx.currentTime + idx * 0.07;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.04, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.19);
      });
    } catch {}
  }, []);

  const playError = useCallback(() => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, []);

  return { playTick, playSuccess, playError };
}

export const PremierePreflightModal: React.FC<PremierePreflightModalProps> = ({
  isOpen,
  onClose,
  folderPath: initialFolderPath,
  folderName: initialFolderName,
  onSuccess
}) => {
  const { playTick, playSuccess, playError } = useSynthesizerAudio();
  const api = (window as any).api || (window as any).electronAPI;

  // Active top-level section: 'generator' | 'relink' | 'logs'
  const [activeSection, setActiveSection] = useState<'generator' | 'relink' | 'logs'>('generator');

  // Generator State
  const [parentFolder, setParentFolder] = useState<string>(initialFolderPath || '');
  const [mode, setMode] = useState<'auto' | 'single' | 'master'>('auto');
  const [detectedMode, setDetectedMode] = useState<'single' | 'master'>('single');
  const [activeMode, setActiveMode] = useState<'single' | 'master'>('single');
  const [subfolders, setSubfolders] = useState<SubfolderItem[]>([]);
  const [cameramanFolders, setCameramanFolders] = useState<CameramanFolderInfo[]>([]);
  const [totalVideos, setTotalVideos] = useState<number>(0);
  const [targetPrprojName, setTargetPrprojName] = useState<string>('');
  const [hasTargetPrproj, setHasTargetPrproj] = useState<boolean>(false);
  const [loadingScan, setLoadingScan] = useState<boolean>(false);
  const [excludedPaths, setExcludedPaths] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');

  // Feature Options
  const [enableExcelReport, setEnableExcelReport] = useState<boolean>(true);
  const [enableRelinkManifest, setEnableRelinkManifest] = useState<boolean>(true);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [relinkTargetFolder, setRelinkTargetFolder] = useState<string>('');
  const [generatingRelinkManifest, setGeneratingRelinkManifest] = useState<boolean>(false);
  const [manifestStats, setManifestStats] = useState<ManifestStats | null>(null);

  // Execution State & Real-time Logs
  const [generating, setGenerating] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [activeProgressStatus, setActiveProgressStatus] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [createdFiles, setCreatedFiles] = useState<string[]>([]);
  const [generatedExcelPath, setGeneratedExcelPath] = useState<string | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ title: string; message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const logBoxRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragCounter = useRef(0);

  const showToast = useCallback((msg: { title: string; message: string; type: 'success' | 'info' | 'warning' | 'error' }) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => prev === msg ? null : prev);
    }, 4500);
  }, []);

  // ── Auto-scroll terminal log console ──────────
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // ── Listen to IPC Progress Updates from Backend ──────────
  useEffect(() => {
    if (!api?.prproj?.onProgress) return;
    const unsubscribe = api.prproj.onProgress((data: any) => {
      if (!data) return;
      if (data.status) {
        setLogs(prev => [...prev, ` [PROG ${data.percent || 0}%] ${data.status}`]);
      }
      const pct = data.percent || 0;
      let calcStep = 1;
      if (pct < 25) calcStep = 1;
      else if (pct < 55) calcStep = 2;
      else if (pct < 85) calcStep = 3;
      else calcStep = 4;

      setProgress(pct);
      setActiveProgressStatus(data.status || '');
      setCurrentStep(calcStep);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (api.prproj?.removeListeners) api.prproj.removeListeners();
    };
  }, [api]);

  // ── Clean Drag-and-drop Paths ───────────────────
  const cleanDroppedPath = (rawPath: string): string => {
    if (!rawPath) return '';
    let p = rawPath.trim().replace(/^["']|["']$/g, '');
    if (p.startsWith('file:///')) {
      p = decodeURIComponent(p.replace(/^file:\/\/\//, ''));
      p = p.replace(/^\/([a-zA-Z]:)/, '$1');
    }
    if (/\.[a-zA-Z0-9]{2,6}$/.test(p)) {
      p = p.replace(/[\\/][^\\/]+$/, '');
    }
    return p;
  };

  // ── Scan Folder with 100% One Tap Engine Logic ──
  const scanFolder = useCallback(async (folderPath: string, targetMode: 'auto' | 'master' | 'single' = mode) => {
    if (!folderPath || !api?.prproj) return;
    setLoadingScan(true);
    try {
      const res = await api.prproj.scanSubfolders({
        parentFolder: folderPath,
        ignoreOutputFolders: true,
        mode: targetMode
      });

      if (res && typeof res === 'object' && res.success !== false) {
        setDetectedMode(res.detectedMode || 'single');
        setActiveMode(res.activeMode || 'single');
        setSubfolders(res.subfolders || []);
        setCameramanFolders(res.cameramanFolders || []);
        setTotalVideos(res.totalVideos || 0);
        setTargetPrprojName(res.targetPrprojName || '');
        setHasTargetPrproj(!!res.hasTargetPrproj);
        setExcludedPaths([]);
      } else {
        setSubfolders(Array.isArray(res) ? res : []);
        setExcludedPaths([]);
      }
    } catch (err) {
      console.error('[Premiere Preflight] Scan error:', err);
      setSubfolders([]);
      setCameramanFolders([]);
      setExcludedPaths([]);
    } finally {
      setLoadingScan(false);
    }
  }, [api, mode]);

  const handleFolderSelect = useCallback(async (path: string, overrideMode?: 'auto' | 'master' | 'single') => {
    const cleanPath = cleanDroppedPath(path);
    setParentFolder(cleanPath);
    if (cleanPath) {
      playTick();
      await scanFolder(cleanPath, overrideMode || mode);
    } else {
      setSubfolders([]);
      setCameramanFolders([]);
      setExcludedPaths([]);
    }
  }, [mode, playTick, scanFolder]);

  // Initial scan on modal open
  useEffect(() => {
    if (isOpen && initialFolderPath) {
      handleFolderSelect(initialFolderPath);
      if (!relinkTargetFolder) setRelinkTargetFolder(initialFolderPath);
    }
  }, [isOpen, initialFolderPath]);

  const handleModeChange = async (newMode: 'single' | 'master') => {
    playTick();
    setMode(newMode);
    setActiveMode(newMode);
    if (parentFolder) {
      await scanFolder(parentFolder, newMode);
    }
  };

  const toggleExclude = (path: string) => {
    playTick();
    setExcludedPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSelectAll = () => {
    playTick();
    setExcludedPaths([]);
  };

  const handleDeselectAll = () => {
    playTick();
    setExcludedPaths(subfolders.map(s => s.path));
  };

  const handleBrowse = async () => {
    if (!api?.dialog) return;
    const p = await api.dialog.openFolder({ title: 'Select Directory (Date Folder or Master Folder)' });
    if (p) {
      await handleFolderSelect(p);
      if (!relinkTargetFolder) setRelinkTargetFolder(p);
    }
  };

  const handleBrowseRelinkFolder = async () => {
    if (!api?.dialog) return;
    const p = await api.dialog.openFolder({ title: 'Select Date Folder or Media Directory to Relink' });
    if (p) {
      playTick();
      setRelinkTargetFolder(p);
      if (!parentFolder) {
        await handleFolderSelect(p);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    let dropped = '';
    if (files && files.length > 0) {
      const file = files[0];
      dropped = (file as any)?.path || '';
    }
    if (!dropped) {
      dropped = e.dataTransfer?.getData('text/plain') || '';
    }
    if (dropped) {
      const p = cleanDroppedPath(dropped);
      await handleFolderSelect(p);
      showToast({
        title: 'Directory Loaded 📂',
        message: `Selected: ${p}`,
        type: 'success'
      });
    }
  };

  // ── Media Relink Manifest (.xlsx) Generation ──
  const handleGenerateRelinkManifest = async () => {
    const target = relinkTargetFolder || parentFolder;
    if (!target) {
      await handleBrowseRelinkFolder();
      return;
    }
    if (!api?.prproj || generatingRelinkManifest) return;

    let activeFolders: string[] = [];
    if (activeMode === 'single') {
      activeFolders = [target];
    } else {
      activeFolders = subfolders.filter(s => !excludedPaths.includes(s.path)).map(s => s.path);
    }
    if (activeFolders.length === 0) activeFolders = [target];

    setGeneratingRelinkManifest(true);
    playTick();

    try {
      const result = await api.prproj.generateRelinkManifest({
        parentFolder: target,
        targetFolders: activeFolders,
        mode: activeMode
      });

      if (result && result.success) {
        const createdPaths: string[] = [];
        if (result.manifests && result.manifests.length > 0) {
          result.manifests.forEach((m: any) => {
            if (m.excelPath) createdPaths.push(m.excelPath);
          });
        }
        if (result.masterManifestPath) {
          createdPaths.push(result.masterManifestPath);
        }

        const firstManifest = result.manifests?.[0];
        setManifestStats({
          totalFiles: result.totalFiles || 0,
          totalFolders: firstManifest?.totalFolders || 0,
          folderName: target.split(/[\\/]/).pop() || '',
          excelPath: createdPaths[0] || ''
        });

        playSuccess();
        showToast({
          title: 'Media Relink Manifest Generated!',
          message: `Indexed ${result.totalFiles || 0} clips into Excel manifest near project file.`,
          type: 'success'
        });
      } else {
        throw new Error(result?.error || 'Manifest generation failed.');
      }
    } catch (err: any) {
      playError();
      showToast({ title: 'Manifest Generation Failed', message: err.message || 'Check logs for details.', type: 'error' });
    } finally {
      setGeneratingRelinkManifest(false);
    }
  };

  // ── Run Project Generation (Exact One Tap IPC) ──
  const runGeneration = async () => {
    if (!parentFolder || !api?.prproj || generating) return;

    let activeFolders: string[] = [];
    if (activeMode === 'single') {
      activeFolders = [parentFolder];
    } else {
      activeFolders = subfolders.filter(s => !excludedPaths.includes(s.path)).map(s => s.path);
    }

    if (activeFolders.length === 0) {
      showToast({ title: 'No Folders Selected', message: 'Please include at least one folder for project creation.', type: 'warning' });
      return;
    }

    const finalExcelFolder = enableExcelReport ? parentFolder : undefined;

    setGenerating(true);
    setIsCompleted(false);
    setCreatedFiles([]);
    setGeneratedExcelPath(null);
    setCurrentStep(1);
    setProgress(5);
    setActiveProgressStatus('Initializing sequence engine...');
    setLogs([
      `[START] Target directory: ${parentFolder}`,
      `[MODE] ${activeMode === 'single' ? `Single Date Folder Mode (Target: ${targetPrprojName})` : `Master Folder Mode (${activeFolders.length} Date Subfolders)`}`,
      `[OVERWRITE] ${overwriteExisting ? 'Enabled (Will overwrite existing .prproj & .xml files)' : 'Disabled (Will skip date folders with existing .prproj files)'}`,
      ...(finalExcelFolder ? [`[EXCEL] Automatic Report Location: ${finalExcelFolder} (Unedit Time & Edit Time columns included)`] : [])
    ]);
    playTick();

    try {
      const result = await api.prproj.generate({
        parentFolder,
        targetFolders: activeFolders,
        mode: activeMode,
        includeSubSubfolders: true,
        ignoreOutputFolders: true,
        overwrite: overwriteExisting,
        excelFolderPath: finalExcelFolder,
        enableRelinkManifest: enableRelinkManifest,
        excludedPaths: activeMode === 'single' ? excludedPaths : []
      });

      setCurrentStep(4);
      setProgress(90);
      setLogs(prev => [...prev, `[STEP 4] Writing gzip Premiere Pro project (.prproj), XML sequence (.xml) & Excel report (.xlsx)...`]);
      await new Promise(r => setTimeout(r, 200));

      if (result && result.success) {
        const newLogs: string[] = [];
        if (result.templateUsed) {
          newLogs.push(`[ENGINE] Template Used: ${result.templateUsed}`);
        }
        if (result.created && result.created.length > 0) {
          result.created.forEach((f: string) => newLogs.push(` ✔ [SEQUENCE TIMELINE READY] ${f.split(/[\\/]/).pop()}`));
        }
        if (result.excelReportPath) {
          newLogs.push(` ✔ [EXCEL REPORT CREATED] ${result.excelReportPath} (Includes Unedit Time & Edit Time tracking columns)`);
        }
        if (result.skipped && result.skipped.length > 0) {
          result.skipped.forEach((f: string) => newLogs.push(` ℹ [SKIPPED - EXISTS] ${f.split(/[\\/]/).pop()}`));
        }
        newLogs.push(`\n✔ Creation Complete! Generated ${result.createdCount} project file(s) with V1/A1 sequence timelines, skipped ${result.skippedCount}.`);

        setProgress(100);
        setIsCompleted(true);
        setCreatedFiles(result.created || []);
        setGeneratedExcelPath(result.excelReportPath || null);
        setLogs(prev => [...prev, ...newLogs]);

        playSuccess();
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });

        showToast({
          title: 'Premiere Projects & Sequences Created!',
          message: `Successfully generated ${result.createdCount} .prproj file(s) with V1/A1 video sequence timelines.`,
          type: 'success'
        });

        if (onSuccess && result.created && result.created.length > 0) {
          onSuccess(result.created[0]);
        }

        // Re-scan folder to update UI badges
        await scanFolder(parentFolder, activeMode);

        // Start countdown to reset
        setResetCountdown(10);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setResetCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownRef.current!);
              countdownRef.current = null;
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        throw new Error(result?.error || 'Generation failed.');
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [...prev, `✖ [ERROR] ${err.message || String(err)}`]);
      playError();
      showToast({ title: 'Generation Failed', message: err.message || 'Check logs for details.', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleFullReset = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setResetCountdown(null);
    setIsCompleted(false);
    setGenerating(false);
    setLogs([]);
    setCreatedFiles([]);
    setGeneratedExcelPath(null);
    setProgress(0);
    setCurrentStep(1);
    setActiveProgressStatus('');
  };

  const renderFormattedLog = (log: string, index: number) => {
    let typeClass = 'log-type-info';
    if (log.includes('✔') || log.includes('[OK]')) typeClass = 'log-type-ok';
    else if (log.includes('ℹ')) typeClass = 'log-type-info';
    else if (log.includes('ENGINE') || log.includes('START') || log.includes('MODE') || log.includes('STEP')) typeClass = 'log-type-engine';
    else if (log.includes('✖') || log.includes('ERROR')) typeClass = 'log-type-error';

    return (
      <div key={index} className="prproj-log-line">
        <span style={{ opacity: 0.4, fontSize: '10px', fontFamily: 'monospace' }}>[{index + 1}]</span>
        <span className={typeClass}>{log}</span>
      </div>
    );
  };

  // Filtered subfolders for Master Mode
  const filteredSubfolders = subfolders.filter(s =>
    search.trim() === '' || s.name.toLowerCase().includes(search.toLowerCase())
  );
  const activeSubfoldersCount = subfolders.filter(s => !excludedPaths.includes(s.path)).length;
  const excludedCount = excludedPaths.length;
  const newCount = subfolders.filter(s => !s.hasPrproj && !excludedPaths.includes(s.path)).length;
  const existsCount = subfolders.filter(s => s.hasPrproj && !excludedPaths.includes(s.path)).length;

  if (!isOpen) return null;

  return (
    <div className="onetap-modal-overlay anim-fade-in" onClick={e => { if (e.target === e.currentTarget && !generating) onClose(); }}>
      <div className="onetap-modal-dialog onetap-theme-wrapper" onClick={e => e.stopPropagation()}>
        {/* Modal Close Button */}
        <button
          className="onetap-modal-close-btn"
          disabled={generating}
          onClick={() => { playTick(); onClose(); }}
          title="Close Premiere Overlay (Esc)"
        >
          ✕
        </button>

        {/* Toast Notification Notification Pill */}
        {toastMsg && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: toastMsg.type === 'error' ? '#ef4444' : toastMsg.type === 'warning' ? '#f59e0b' : '#10b981',
            color: '#FFFFFF',
            padding: '10px 22px',
            borderRadius: '30px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease'
          }}>
            <span>{toastMsg.type === 'error' ? '✖' : toastMsg.type === 'warning' ? '⚠️' : '✔'}</span>
            <span>{toastMsg.title}: {toastMsg.message}</span>
          </div>
        )}

        <div className="onetap-modal-dialog-scroll">
          <div className="prproj-page">
            {/* ── Page Header ── */}
            <div className="prproj-header">
              <div className="prproj-icon">
                <img src={prLogo} alt="Premiere Pro" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              </div>
              <div>
                <h1 className="prproj-title">Premiere Pro Project Generator</h1>
                <div className="prproj-subtitle">
                  Batch build Adobe Premiere Pro (.prproj) project files and sequence timelines directly from media subfolders. Place clips unnested on V1/A1 with camera marker color routing.
                </div>
              </div>
            </div>

            {/* ── Section Page Navigation Bar (Apple Segmented Bar) ── */}
            <div className="prproj-section-nav">
              <button
                type="button"
                className={`prproj-section-nav-btn ${activeSection === 'generator' ? 'active' : ''}`}
                onClick={() => { playTick(); setActiveSection('generator'); }}
              >
                <span style={{ fontSize: '16px' }}>🎞️</span>
                <span>Project &amp; Sequence Generator</span>
                <span className="prproj-section-nav-badge">
                  {parentFolder ? (activeMode === 'single' ? 'Single Date / Slot' : `${subfolders.length} Folders`) : 'Primary'}
                </span>
              </button>

              <button
                type="button"
                className={`prproj-section-nav-btn ${activeSection === 'relink' ? 'active' : ''}`}
                onClick={() => { playTick(); setActiveSection('relink'); }}
              >
                <span style={{ fontSize: '16px' }}>🔗</span>
                <span>Media Relocation &amp; Relink Excel</span>
                {manifestStats ? (
                  <span className="prproj-section-nav-badge" style={{ background: 'color-mix(in srgb, #10B981 16%, transparent)', color: '#10B981' }}>
                    ✓ Ready ({manifestStats.totalFiles})
                  </span>
                ) : (
                  <span className="prproj-section-nav-badge">Relinker</span>
                )}
              </button>

              <button
                type="button"
                className={`prproj-section-nav-btn ${activeSection === 'logs' ? 'active' : ''}`}
                onClick={() => { playTick(); setActiveSection('logs'); }}
              >
                <span style={{ fontSize: '16px' }}>📜</span>
                <span>Engine Status &amp; Logs</span>
                {logs.length > 0 && (
                  <span className="prproj-section-nav-badge">{logs.length}</span>
                )}
              </button>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION 1: PROJECT & SEQUENCE GENERATOR
            ══════════════════════════════════════════════════════════ */}
            {activeSection === 'generator' && (
              <>
                {/* ── Template & Engine Status Banner ── */}
                <div className="card" style={{ padding: '14px 20px', borderLeft: '4px solid #9999FF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>🎞️</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          Sequence Generator Engine: Active (Single Date / Slot &amp; Master Folder Modes)
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Generates .xml &amp; .prproj files with sequence timeline markers for cameraman folders (Q, BQ, M, BM, MZ, Z, BZ, AQ, N, ID, Waaz). Open .xml in Premiere Pro.
                        </div>
                      </div>
                    </div>
                    <span className="prproj-status-badge badge-new" style={{ textTransform: 'uppercase' }}>
                      Engine Ready
                    </span>
                  </div>
                </div>

                {/* ── Main Folder Selector Card ── */}
                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#9999FF' }} />
                    <span className="card-header-title" style={{ color: '#9999FF' }}>
                      1. Select Directory (Drop Date Folder, Slot Folder, or Master Folder)
                    </span>
                  </div>
                  <div
                    style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="browse-row">
                      <div className="input-wrap">
                        <label className="input-label" style={{ color: '#9999FF' }}>
                          <span className="input-label-dot" style={{ background: '#9999FF' }} />
                          TARGET DIRECTORY
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={parentFolder}
                          placeholder="Drop or select a Date folder (e.g. 2026-07-21), Slot folder, or Master folder..."
                          onChange={e => handleFolderSelect(e.target.value)}
                        />
                      </div>
                      <button className="browse-btn" onClick={handleBrowse}>
                        <span>📁</span>
                        <span>Browse...</span>
                      </button>
                    </div>

                    <div
                      className={`prproj-dropzone ${isDragging ? 'drag-active' : ''}`}
                      onDragEnter={handleDragEnter}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleBrowse}
                    >
                      <span className="prproj-dropzone-icon">📂</span>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>
                        Drag &amp; Drop Date Folder, Slot, or Master Directory Here
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Drop a single slot/date folder (containing camera angle folders) or a master folder containing multiple date subfolders
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Excel Sequence Report Options Card ── */}
                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#10B981' }} />
                    <span className="card-header-title" style={{ color: '#10B981' }}>
                      2. Excel Sequence Summary Report (.xlsx)
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>📊 Auto-Generate Date-Wise Excel Sequence Report</span>
                          <span className="prproj-status-badge badge-new" style={{ background: '#059669', color: '#FFF' }}>
                            Automatic Output Path
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                          Generates an Excel (.xlsx) report containing <strong>Unedit Duration</strong> (initial sequence duration) and <strong>Edit Duration</strong> (updated timeline duration after editing) alongside cameraman prefix clip counts. The report is saved automatically directly inside the target directory.
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-2)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-soft)', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={enableExcelReport}
                          onChange={e => { playTick(); setEnableExcelReport(e.target.checked); }}
                          style={{ width: '18px', height: '18px', accentColor: '#10B981', cursor: 'pointer' }}
                        />
                        <span>Enable Excel Report</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── Media Relocation Manifest (.xlsx & .json) Card ── */}
                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#6366F1' }} />
                    <span className="card-header-title" style={{ color: '#6366F1' }}>
                      3. Media Relocation Manifest (.xlsx &amp; .json) for Premiere Pro
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>🔗 Media Relocation &amp; Relink Manifest Generator</span>
                          <span className="prproj-status-badge badge-new" style={{ background: '#6366F1', color: '#FFF' }}>
                            Saved Near .prproj File
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                          Generates an Excel relocation manifest (<code>Media_Relink_Manifest_&lt;Date&gt;.xlsx</code> &amp; companion <code>.json</code>) right next to each project file so the <strong>One Tap Premiere Pro Extension</strong> can automatically locate, match, and relink missing footage with 100% precision.
                        </div>
                        {parentFolder ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'var(--surface-2)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-soft)', marginTop: '8px', display: 'inline-block' }}>
                            Target Folder: {parentFolder}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-2)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-soft)', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={enableRelinkManifest}
                            onChange={e => { playTick(); setEnableRelinkManifest(e.target.checked); }}
                            style={{ width: '18px', height: '18px', accentColor: '#6366F1', cursor: 'pointer' }}
                          />
                          <span>Auto-Create with Project</span>
                        </label>

                        <button
                          className="prproj-action-btn"
                          disabled={generating || generatingRelinkManifest}
                          onClick={handleGenerateRelinkManifest}
                          style={{
                            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                            color: '#FFF',
                            border: 'none',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: 750,
                            cursor: (generating || generatingRelinkManifest) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: 'auto',
                            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
                          }}
                        >
                          {generatingRelinkManifest ? (
                            <span>⏳ Generating Manifest...</span>
                          ) : (
                            <>
                              <span>📊</span>
                              <span>Generate Relink Manifest (.xlsx) Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {manifestStats && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'rgba(99, 102, 241, 0.10)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: '10px', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>✔</span>
                          <div>
                            <div style={{ fontWeight: 750, fontSize: '13px', color: 'var(--text-primary)' }}>
                              Media Relink Manifest Ready ({manifestStats.totalFiles} video clips indexed)
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                              {manifestStats.excelPath.split(/[\\/]/).pop()}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="prproj-btn-sm"
                            style={{ background: '#6366F1', color: '#FFF', border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                            onClick={() => api?.shell?.openFolder(manifestStats.excelPath)}
                          >
                            📂 Open Folder
                          </button>
                          <button
                            className="prproj-btn-sm"
                            style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                            onClick={() => {
                              navigator.clipboard.writeText(manifestStats.excelPath);
                              showToast({ title: 'Path Copied', message: 'Manifest path copied to clipboard.', type: 'info' });
                            }}
                          >
                            📋 Copy Path
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Mode Selector & Folder Preview ── */}
                {parentFolder && (
                  <div className="card">
                    <div style={{ padding: '16px 20px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                          Target Mode:
                        </span>
                        <div className="prproj-mode-selector">
                          <button
                            className={`prproj-mode-tab ${activeMode === 'single' ? 'active' : ''}`}
                            onClick={() => handleModeChange('single')}
                          >
                            🎯 Single Date Folder / Slot
                          </button>
                          <button
                            className={`prproj-mode-tab ${activeMode === 'master' ? 'active' : ''}`}
                            onClick={() => handleModeChange('master')}
                          >
                            📁 Master Folder ({subfolders.length} Subfolders)
                          </button>
                        </div>
                      </div>

                      <span className="prproj-status-badge badge-new" style={{ fontSize: '12px' }}>
                        {detectedMode === activeMode ? `✨ Auto-Detected Mode` : `⚙️ Manual Mode Override`}
                      </span>
                    </div>

                    {/* Single Date / Slot Folder Preview */}
                    {activeMode === 'single' && (() => {
                      const isCamExcluded = (cam: CameramanFolderInfo) =>
                        excludedPaths.includes(cam.path) || excludedPaths.includes(cam.name);
                      const activeCamFolders = cameramanFolders.filter(c => !isCamExcluded(c));
                      const activeSingleVideosCount = cameramanFolders.length > 0
                        ? activeCamFolders.reduce((sum, c) => sum + (c.videoCount || 0), 0)
                        : totalVideos;
                      const excludedCamCount = cameramanFolders.filter(c => isCamExcluded(c)).length;

                      return (
                        <div style={{ padding: '20px' }}>
                          <div className="prproj-single-preview">
                            <div className="prproj-single-header">
                              <div>
                                <div className="prproj-single-title">
                                  📅 Target: {parentFolder.split(/[\\/]/).pop()}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                                  Target Project: {targetPrprojName || `${parentFolder.split(/[\\/]/).pop()}.prproj`}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {hasTargetPrproj ? (
                                  <span className="prproj-status-badge badge-exists">✓ Project File Exists</span>
                                ) : (
                                  <span className="prproj-status-badge badge-new">+ Will Create Project</span>
                                )}
                                <span style={{ fontSize: '12px', fontWeight: 700, background: 'var(--surface-2)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
                                  🎬 {activeSingleVideosCount} Active Clip(s) {excludedCamCount > 0 ? `(${totalVideos - activeSingleVideosCount} Excluded)` : ''}
                                </span>
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                                  Detected Camera Angle Folders ({cameramanFolders.length} Folders{excludedCamCount > 0 ? `, ${excludedCamCount} Excluded` : ''}):
                                </div>
                                {cameramanFolders.length > 0 && (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="prproj-btn-sm" onClick={handleSelectAll}>
                                      ✓ Include All
                                    </button>
                                    <button className="prproj-btn-sm" onClick={() => setExcludedPaths(cameramanFolders.map(c => c.path))}>
                                      ✖ Exclude All
                                    </button>
                                    {excludedCamCount > 0 && (
                                      <button className="prproj-btn-sm" onClick={() => setExcludedPaths([])}>
                                        🔄 Reset
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {cameramanFolders.length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '12px', borderRadius: '8px' }}>
                                  No cameraman subfolders detected. Videos in this folder will be placed directly on V1/A1.
                                </div>
                              ) : (
                                <div className="cameraman-grid">
                                  {cameramanFolders.map((cam, idx) => {
                                    const isExcluded = isCamExcluded(cam);
                                    const rgb = cam.markerColor || { red: 255, green: 255, blue: 255 };
                                    const displayName = cam.markerName || cam.name;
                                    const description = cam.markerDescription;
                                    return (
                                      <div key={idx} className={`cameraman-card ${isExcluded ? 'is-excluded' : ''}`}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span
                                            className="cameraman-marker-badge"
                                            style={{ backgroundColor: `rgb(${rgb.red}, ${rgb.green}, ${rgb.blue})` }}
                                            title={`Timeline Marker Color: ${rgb.name || ''} RGB(${rgb.red}, ${rgb.green}, ${rgb.blue})`}
                                          />
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontWeight: 700, fontSize: '13px', color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                                🏷️ {displayName}
                                              </span>
                                              {isExcluded && (
                                                <span className="prproj-status-badge badge-excluded" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                                  Excluded
                                                </span>
                                              )}
                                            </div>
                                            {description ? (
                                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                📝 {description}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-1)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {cam.videoCount} clip(s)
                                          </span>
                                          {isExcluded ? (
                                            <button
                                              className="prproj-restore-btn"
                                              title="Re-include this folder in sequence"
                                              onClick={() => toggleExclude(cam.path)}
                                            >
                                              ➕ Include
                                            </button>
                                          ) : (
                                            <button
                                              className="prproj-remove-btn"
                                              title="Remove folder from sequence creation"
                                              onClick={() => toggleExclude(cam.path)}
                                            >
                                              🗑️ Remove
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Master Folder Subfolders Table */}
                    {activeMode === 'master' && (
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="prproj-toolbar">
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {newCount} date folder(s) will receive new .prproj sequence files, {existsCount} already exist
                            {excludedCount > 0 ? `, ${excludedCount} excluded.` : '.'}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="prproj-btn-sm" onClick={handleSelectAll}>
                              ✓ Select All
                            </button>
                            <button className="prproj-btn-sm" onClick={handleDeselectAll}>
                              ✖ Remove All
                            </button>
                            {excludedCount > 0 && (
                              <button className="prproj-btn-sm" onClick={() => scanFolder(parentFolder, 'master')}>
                                🔄 Reset List
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          type="text"
                          className="utils-search-input"
                          placeholder="Search date subfolders by name..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          style={{ width: '100%' }}
                        />

                        {loadingScan ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Scanning subfolders and counting video clips...
                          </div>
                        ) : filteredSubfolders.length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '12px' }}>
                            No date subfolders found in this parent directory.
                          </div>
                        ) : (
                          <div className="prproj-table-container">
                            <table className="prproj-subfolder-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                  <th>Date Subfolder</th>
                                  <th>Clips Detected</th>
                                  <th>Target .prproj File</th>
                                  <th style={{ textAlign: 'center' }}>Status</th>
                                  <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredSubfolders.map((item, idx) => {
                                  const isExcluded = excludedPaths.includes(item.path);
                                  return (
                                    <tr key={idx} className={isExcluded ? 'is-excluded' : ''}>
                                      <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                        {idx + 1}
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '16px' }}>📁</span>
                                          <span
                                            className="prproj-cell-truncate"
                                            title={item.name}
                                            style={{ fontWeight: 600, color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}
                                          >
                                            {item.name}
                                          </span>
                                        </div>
                                      </td>
                                      <td>
                                        <span style={{ fontSize: '12px', fontWeight: 700, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                          🎬 {item.videoCount || 0} clip(s)
                                        </span>
                                      </td>
                                      <td className="prproj-cell-truncate" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }} title={`${item.name}.prproj`}>
                                        {item.name}.prproj
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isExcluded ? (
                                          <span className="prproj-status-badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Excluded</span>
                                        ) : item.hasPrproj ? (
                                          <span className="prproj-status-badge badge-exists">✓ Exists</span>
                                        ) : (
                                          <span className="prproj-status-badge badge-new">+ Will Create</span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isExcluded ? (
                                          <button
                                            className="prproj-restore-btn"
                                            title="Re-include this folder"
                                            onClick={() => toggleExclude(item.path)}
                                          >
                                            ➕ Include
                                          </button>
                                        ) : (
                                          <button
                                            className="prproj-remove-btn"
                                            title="Remove folder from project creation"
                                            onClick={() => toggleExclude(item.path)}
                                          >
                                            🗑️ Remove
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Action & Creation HUD Card ── */}
                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#9999FF' }} />
                    <span className="card-header-title" style={{ color: '#9999FF' }}>
                      4. Generate Premiere Projects &amp; Sequences
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!generating && !isCompleted && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--surface-2)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-soft)' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              checked={overwriteExisting}
                              onChange={e => { playTick(); setOverwriteExisting(e.target.checked); }}
                              style={{ width: '18px', height: '18px', accentColor: '#9999FF', cursor: 'pointer' }}
                            />
                            <span>Force Overwrite Existing .prproj &amp; .xml Files</span>
                          </label>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {overwriteExisting
                              ? '⚠️ Will overwrite existing project & sequence files.'
                              : '🛡️ Skipping folders that already contain a .prproj file.'}
                          </div>
                        </div>

                        <button
                          className="prproj-action-btn"
                          disabled={!parentFolder || (activeMode === 'master' && activeSubfoldersCount === 0)}
                          onClick={runGeneration}
                        >
                          {activeMode === 'single'
                            ? `🎬 Generate Premiere Project for Date Folder "${parentFolder.split(/[\\/]/).pop()}"`
                            : `🎬 Generate Premiere Projects in ${activeSubfoldersCount} Date Subfolders`}
                        </button>
                      </>
                    )}

                    {/* Active Creation HUD */}
                    {generating && (
                      <div className="prproj-creation-hud">
                        <div className="prproj-hud-header">
                          <div className="prproj-hud-reel-wrapper">
                            <div className="prproj-hud-reel-bg" />
                            <span className="prproj-hud-reel-icon">🎬</span>
                          </div>
                          <div>
                            <div className="prproj-hud-title">Creating Premiere Pro Projects &amp; Sequences...</div>
                            <div className="prproj-hud-status-text">
                              <span className="prproj-status-badge badge-new">ENGINE ACTIVE</span>
                              <span>{activeProgressStatus || 'Placing clips unnested on V1/A1 & writing colored markers...'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Steps Grid */}
                        <div className="prproj-steps-grid">
                          <div className={`prproj-step-card ${currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : ''}`}>
                            <div className="prproj-step-num">{currentStep > 1 ? '✓' : '1'}</div>
                            <div className="prproj-step-label">1. Media &amp; Camera Scan</div>
                          </div>
                          <div className={`prproj-step-card ${currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : ''}`}>
                            <div className="prproj-step-num">{currentStep > 2 ? '✓' : '2'}</div>
                            <div className="prproj-step-label">2. Unnested V1/A1 Build</div>
                          </div>
                          <div className={`prproj-step-card ${currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : ''}`}>
                            <div className="prproj-step-num">{currentStep > 3 ? '✓' : '3'}</div>
                            <div className="prproj-step-label">3. Camera Color Markers</div>
                          </div>
                          <div className={`prproj-step-card ${currentStep > 4 || progress === 100 ? 'completed' : currentStep === 4 ? 'active' : ''}`}>
                            <div className="prproj-step-num">{progress === 100 ? '✓' : '4'}</div>
                            <div className="prproj-step-label">4. Output .prproj &amp; Excel</div>
                          </div>
                        </div>

                        {/* Neon Progress Bar */}
                        <div className="prproj-progress-container">
                          <div className="prproj-progress-header">
                            <span>Creation Engine Progress</span>
                            <span style={{ color: '#34D399' }}>{progress}%</span>
                          </div>
                          <div className="prproj-progress-track">
                            <div className="prproj-progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Completion Celebration Hero Card */}
                    {isCompleted && (
                      <div className="prproj-celebration-card">
                        <div className="prproj-celebration-icon-ring">✔</div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>
                            Premiere Pro Projects &amp; Sequences Created!
                          </h3>
                          <div style={{ fontSize: '13px', color: '#A7F3D0', marginTop: '6px' }}>
                            {activeMode === 'single'
                              ? `Successfully generated 1 Premiere project for "${parentFolder.split(/[\\/]/).pop()}" with V1/A1 unnested clip placement.`
                              : `Successfully generated ${createdFiles.length} Premiere project(s) with V1/A1 unnested clip placement.`}
                          </div>
                        </div>

                        {createdFiles.length > 0 && (
                          <div className="prproj-created-files-chips">
                            {createdFiles.map((file, idx) => (
                              <div key={idx} className="prproj-created-chip">
                                <span>🎬</span>
                                <span>{file.split(/[\\/]/).pop()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {generatedExcelPath && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', padding: '12px 18px', borderRadius: '12px', width: '100%', maxWidth: '600px' }}>
                            <span style={{ fontSize: '22px' }}>📊</span>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#6EE7B7' }}>
                                Excel Sequence Report Created:
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {generatedExcelPath.split(/[\\/]/).pop()}
                              </div>
                            </div>
                            <button
                              className="prproj-btn-sm"
                              style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
                              onClick={() => api?.shell?.openFolder(generatedExcelPath)}
                            >
                              📂 Open Excel Folder
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                          <button
                            className="prproj-action-btn"
                            style={{ width: 'auto', padding: '14px 28px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                            onClick={() => api?.shell?.openFolder(parentFolder)}
                          >
                            📂 Open Output Directory
                          </button>
                          <button
                            className="prproj-action-btn"
                            style={{ width: 'auto', padding: '14px 28px', background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: '13px' }}
                            onClick={handleFullReset}
                          >
                            🔄 Create Another Project Set
                            {resetCountdown !== null && (
                              <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 800 }}>
                                Auto-reset in {resetCountdown}s
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cyber Log Console */}
                    {logs.length > 0 && (
                      <div className="prproj-cyber-console">
                        <div className="prproj-console-bar">
                          <div className="prproj-console-dots">
                            <div className="prproj-console-dot" style={{ background: '#FF5F56' }} />
                            <div className="prproj-console-dot" style={{ background: '#FFBD2E' }} />
                            <div className="prproj-console-dot" style={{ background: '#27C93F' }} />
                          </div>
                          <div className="prproj-console-title">⚡ SEQUENCE ENGINE TERMINAL CONSOLE</div>
                          <button
                            className="prproj-btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => {
                              navigator.clipboard.writeText(logs.join('\n'));
                              showToast({ title: 'Logs Copied', message: 'Engine console logs copied to clipboard.', type: 'info' });
                            }}
                          >
                            📋 Copy Logs
                          </button>
                        </div>
                        <div ref={logBoxRef} className="prproj-log-box" style={{ maxHeight: '220px' }}>
                          {logs.map((log, i) => renderFormattedLog(log, i))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION 2: MEDIA RELOCATION & RELINK EXCEL MANIFEST
            ══════════════════════════════════════════════════════════ */}
            {activeSection === 'relink' && (
              <>
                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#9999FF' }} />
                    <span className="card-header-title" style={{ color: '#9999FF' }}>
                      Media Relocation &amp; Relink Manifest Generator
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      Browse and select the <strong>Date Folder containing media to be relinked</strong>. Generates an Excel manifest (<code>Media_Relink_Manifest_&lt;Date&gt;.xlsx</code> &amp; companion <code>.json</code>) near the <code>.prproj</code> project file so the <strong>One Tap Premiere Pro Extension</strong> can automatically bring all offline clips back online with 100% precision.
                    </div>

                    <div className="browse-row">
                      <div className="input-wrap">
                        <label className="input-label" style={{ color: '#9999FF' }}>
                          <span className="input-label-dot" style={{ background: '#9999FF' }} />
                          FOLDER TO BE RELINKED
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={relinkTargetFolder || parentFolder}
                          placeholder="Browse or select the date folder containing video clips to be relinked..."
                          onChange={e => setRelinkTargetFolder(e.target.value)}
                        />
                      </div>
                      <button className="browse-btn" onClick={handleBrowseRelinkFolder}>
                        <span>📁</span>
                        <span>Browse...</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingTop: '4px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={enableRelinkManifest}
                          onChange={e => { playTick(); setEnableRelinkManifest(e.target.checked); }}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--theme-accent)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Auto-create manifest when generating project
                        </span>
                      </label>

                      <button
                        className="prproj-generate-relink-btn"
                        disabled={generatingRelinkManifest}
                        onClick={handleGenerateRelinkManifest}
                      >
                        {generatingRelinkManifest ? (
                          <span>⏳ Generating Manifest...</span>
                        ) : !(relinkTargetFolder || parentFolder) ? (
                          <>
                            <span>📁</span>
                            <span>Browse Folder &amp; Generate Manifest</span>
                          </>
                        ) : (
                          <>
                            <span>📊</span>
                            <span>Generate Relink Manifest (.xlsx)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {manifestStats && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'rgba(16, 185, 129, 0.10)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '14px 18px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '20px', color: '#10B981' }}>✔</span>
                          <div>
                            <div style={{ fontWeight: 750, fontSize: '13px', color: 'var(--text-primary)' }}>
                              Media Relink Manifest Ready ({manifestStats.totalFiles} video clips indexed)
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                              {manifestStats.excelPath}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="prproj-btn-sm"
                            style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '7px 14px', fontSize: '11px', fontWeight: 700, borderRadius: '7px' }}
                            onClick={() => api?.shell?.openFolder(manifestStats.excelPath)}
                          >
                            📂 Open Folder
                          </button>
                          <button
                            className="prproj-btn-sm"
                            style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '7px 14px', fontSize: '11px', fontWeight: 700, borderRadius: '7px' }}
                            onClick={() => {
                              navigator.clipboard.writeText(manifestStats.excelPath);
                              showToast({ title: 'Path Copied', message: 'Manifest path copied to clipboard.', type: 'info' });
                            }}
                          >
                            📋 Copy Path
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* How Relinking Works in Premiere Pro Extension */}
                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#9999FF' }} />
                    <span className="card-header-title" style={{ color: '#9999FF' }}>
                      How Media Relinking Works with Premiere Pro Extension
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="relink-steps-grid">
                      <div className="relink-step-card">
                        <div className="relink-step-header">
                          <div className="relink-step-num">1</div>
                          <div className="relink-step-title">Generate Manifest</div>
                        </div>
                        <div className="relink-step-desc">
                          Select your Date folder above and click <strong>Generate Relink Manifest</strong>. An Excel sheet (<code>Media_Relink_Manifest_&lt;Date&gt;.xlsx</code>) and companion JSON are created right next to your project file.
                        </div>
                      </div>

                      <div className="relink-step-card">
                        <div className="relink-step-header">
                          <div className="relink-step-num">2</div>
                          <div className="relink-step-title">Open Premiere Pro</div>
                        </div>
                        <div className="relink-step-desc">
                          Launch Adobe Premiere Pro and open the project. If any media is offline due to moved folders or drive letter changes, open <strong>Window &gt; Extensions &gt; One Tap</strong>.
                        </div>
                      </div>

                      <div className="relink-step-card">
                        <div className="relink-step-header">
                          <div className="relink-step-num">3</div>
                          <div className="relink-step-title">One-Click Auto-Relink</div>
                        </div>
                        <div className="relink-step-desc">
                          Click <strong>🔗 Relink Missing Media via Excel Manifest</strong> in the One Tap extension. All offline clips will reconnect instantly with 100% camera bin precision!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION 3: ENGINE STATUS & EXECUTION LOGS
            ══════════════════════════════════════════════════════════ */}
            {activeSection === 'logs' && (
              <>
                <div className="card" style={{ padding: '14px 20px', borderLeft: '4px solid #9999FF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>🎞️</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          Sequence Generator Engine: Active (Single Date &amp; Master Folder Modes)
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Generates .xml &amp; .prproj files with sequence timeline markers for cameraman folders. Open .xml in Premiere Pro.
                        </div>
                      </div>
                    </div>
                    <span className="prproj-status-badge badge-new" style={{ textTransform: 'uppercase' }}>
                      Ready
                    </span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-header-stripe" style={{ background: '#10B981' }} />
                    <span className="card-header-title" style={{ color: '#10B981' }}>
                      📜 Sequence Engine Terminal Console
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Total Log Entries: <strong>{logs.length}</strong> | Engine Status: <strong>Active</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="prproj-btn-sm"
                          style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
                          onClick={() => {
                            navigator.clipboard.writeText(logs.join('\n'));
                            showToast({ title: 'Logs Copied', message: 'All logs copied to clipboard.', type: 'info' });
                          }}
                        >
                          📋 Copy All Logs
                        </button>
                        <button
                          className="prproj-btn-sm"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
                          onClick={() => {
                            playTick();
                            setLogs([]);
                            showToast({ title: 'Logs Cleared', message: 'Console log history reset.', type: 'info' });
                          }}
                        >
                          🗑️ Clear Logs
                        </button>
                      </div>
                    </div>

                    <div className="prproj-cyber-console" style={{ marginTop: '4px' }}>
                      <div className="prproj-console-bar">
                        <div className="prproj-console-dots">
                          <div className="prproj-console-dot" style={{ background: '#FF5F56' }} />
                          <div className="prproj-console-dot" style={{ background: '#FFBD2E' }} />
                          <div className="prproj-console-dot" style={{ background: '#27C93F' }} />
                        </div>
                        <div className="prproj-console-title">⚡ REAL-TIME ENGINE LOG STREAM</div>
                      </div>
                      <div ref={logBoxRef} className="prproj-log-box" style={{ maxHeight: '420px', minHeight: '260px' }}>
                        {logs.length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No execution logs recorded yet. Run a project generation or relink scan to view activity.
                          </div>
                        ) : (
                          logs.map((log, i) => renderFormattedLog(log, i))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
