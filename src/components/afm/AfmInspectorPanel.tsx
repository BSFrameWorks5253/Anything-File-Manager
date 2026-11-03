import React, { useState, useEffect } from 'react';
import {
  Film,
  Clock,
  Layers,
  HardDrive,
  FolderTree,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Tag
} from 'lucide-react';
import {
  ProductionStage,
  PRODUCTION_STAGES,
  formatCumulativeDuration,
  classifyFolder
} from '../../utils/afmTaxonomy';
import { formatBytes } from '../../utils';
import { mediaService, oneTapService } from '../../services';
import { PremierePreflightModal } from './PremierePreflightModal';

interface AfmInspectorPanelProps {
  folderPath: string;
  folderName: string;
  onRefresh?: () => void;
}

export const AfmInspectorPanel: React.FC<AfmInspectorPanelProps> = ({
  folderPath,
  folderName,
  onRefresh
}) => {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<ProductionStage>('stage1');
  const [isPreflightOpen, setIsPreflightOpen] = useState(false);
  const [oneTapStats, setOneTapStats] = useState<any>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const classification = classifyFolder(folderName, folderPath);

  const fetchAnalytics = async () => {
    if (!folderPath) return;
    setLoading(true);
    try {
      const data = await mediaService.analyzeAfmFolder(folderPath);
      if (data) {
        setAnalytics(data);
        if (data.stage) setCurrentStage(data.stage);
      }

      // Fetch One Tap tracker metrics for this session/folder
      const otRes = await oneTapService.getTaskTrackerStats(folderName);
      if (otRes.ok && otRes.stats) {
        setOneTapStats(otRes.stats);
      }
    } catch (err) {
      console.error('[AfmInspector] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [folderPath]);

  const handleStageChange = async (newStage: ProductionStage) => {
    setCurrentStage(newStage);
    try {
      await mediaService.setAfmStage(folderPath, newStage);
      if (onRefresh) onRefresh();
    } catch {}
  };

  const handleSeparatePV = async () => {
    setActionFeedback('Separating photos & videos...');
    try {
      const res = await oneTapService.separatePhotosAndVideos(folderPath);
      if (res.ok) {
        setActionFeedback(`Done! Moved ${res.photosMoved || 0} photos & ${res.videosMoved || 0} videos.`);
        if (onRefresh) onRefresh();
      } else {
        setActionFeedback(res.error || 'Failed to separate files.');
      }
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      setActionFeedback('Action failed.');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const activeStageConfig = PRODUCTION_STAGES[currentStage] || PRODUCTION_STAGES.stage1;

  return (
    <div className="flex flex-col h-full bg-[var(--mac-bg-sidebar)] select-none text-[var(--mac-text-primary)] overflow-y-auto">
      {/* ── Production Header & Scope ── */}
      <div className="p-3.5 border-b mac-border mac-header">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mac-text-secondary)]">
              AFM Production Engine
            </span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
            title="Recalculate Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Classification Title & Scope Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold truncate block" title={folderName}>
              {folderName}
            </span>
            <span className="text-[10.5px] text-[var(--mac-text-secondary)] font-mono block mt-0.5 truncate">
              {classification.type === 'master_safar'
                ? `Master Safar • ${classification.masterTokens?.city || ''}`
                : classification.type === 'date_session'
                ? `Date Session • ${classification.dateTokens?.date || ''} (${classification.dateTokens?.sessionPeriod === 'M' ? 'Morning' : 'Evening'})`
                : classification.type === 'slot_item_a'
                ? `Slot ${classification.slotTokens?.slotNo} • ITS ${classification.slotTokens?.its || 'N/A'}`
                : 'Workspace Asset Folder'}
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/15 border border-purple-500/30 text-purple-300 flex-shrink-0">
            {classification.type === 'master_safar' ? 'MASTER' : classification.type === 'date_session' ? 'DATE WORK' : 'SLOT'}
          </span>
        </div>

        {/* Workflow Lifecycle Stage Dropdown */}
        <div className="mt-3">
          <label className="text-[10px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider block mb-1">
            Production Pipeline Stage
          </label>
          <div className="relative">
            <select
              value={currentStage}
              onChange={e => handleStageChange(e.target.value as ProductionStage)}
              className={`w-full appearance-none h-8 pl-3 pr-8 rounded-lg border text-xs font-semibold focus:outline-none transition-colors cursor-pointer ${activeStageConfig.bgClass} ${activeStageConfig.textClass} ${activeStageConfig.borderClass}`}
            >
              {Object.values(PRODUCTION_STAGES).map(st => (
                <option key={st.id} value={st.id} className="bg-[#141620] text-gray-200">
                  {st.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          </div>
        </div>
      </div>

      {/* ── Aggregate Media Runtime & Stats ── */}
      <div className="p-3.5 space-y-3">
        {/* Cumulative Video Runtime Card */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-transparent border border-amber-500/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Cumulative Video Runtime
            </span>
            <span className="text-[10px] font-mono text-[var(--mac-text-muted)]">
              {analytics ? `${Math.round(analytics.cumulativeDurationSeconds)}s` : '—'}
            </span>
          </div>

          <div className="text-2xl font-black font-mono tracking-tight text-amber-300">
            {analytics
              ? formatCumulativeDuration(analytics.cumulativeDurationSeconds)
              : '00:00:00'}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--mac-text-secondary)] mt-2 pt-2 border-t border-white/10 font-medium">
            <span>{analytics?.videoClipCount || 0} Camera Clips</span>
            <span>•</span>
            <span>{analytics?.stillPhotoCount || 0} Photos</span>
            <span>•</span>
            <span>{formatBytes(analytics?.totalStorageBytes || 0)}</span>
          </div>
        </div>

        {/* Duplicate ITS / Validation Warning */}
        {analytics?.duplicateItsList && analytics.duplicateItsList.length > 0 && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Duplicate ITS Detected!</span>
              <span className="text-[11px] opacity-90 block mt-0.5">
                ITS {analytics.duplicateItsList.join(', ')} exists in multiple slot folders!
              </span>
            </div>
          </div>
        )}

        {/* Malformed ITS Warning */}
        {analytics?.malformedItsList && analytics.malformedItsList.length > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Malformed ITS Format</span>
              <span className="text-[11px] opacity-90 block mt-0.5">
                Must be 5 to 8 digits: {analytics.malformedItsList.join(', ')}
              </span>
            </div>
          </div>
        )}

        {/* ── Breakdown Tables (Slot-by-Slot or Date-by-Date) ── */}
        {analytics?.slots && analytics.slots.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider block">
              Slot-by-Slot Breakdown ({analytics.slots.length} Slots)
            </span>
            <div className="border mac-border rounded-xl overflow-hidden bg-black/10 dark:bg-black/30 max-h-56 overflow-y-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b mac-border mac-header text-[9.5px] uppercase text-[var(--mac-text-muted)]">
                    <th className="py-1.5 px-2 text-left">Slot</th>
                    <th className="py-1.5 px-2 text-left">Person</th>
                    <th className="py-1.5 px-2 text-center">Clips</th>
                    <th className="py-1.5 px-2 text-right">Runtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y mac-border">
                  {analytics.slots.map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-1.5 px-2 font-mono font-bold text-purple-300 truncate max-w-[90px]" title={s.slotFolder}>
                        {s.slotNo}-{s.eventCode}
                      </td>
                      <td className="py-1.5 px-2 truncate max-w-[85px] text-[var(--mac-text-secondary)]" title={s.personName}>
                        {s.personName}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-gray-400">
                        {s.clipCount}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-amber-300">
                        {formatCumulativeDuration(s.duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Master Safar Multi-Date Breakdown */}
        {analytics?.dates && analytics.dates.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider block">
              Dates / Sessions ({analytics.dates.length} Dates)
            </span>
            <div className="border mac-border rounded-xl overflow-hidden bg-black/10 dark:bg-black/30 max-h-56 overflow-y-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b mac-border mac-header text-[9.5px] uppercase text-[var(--mac-text-muted)]">
                    <th className="py-1.5 px-2 text-left">Date Session</th>
                    <th className="py-1.5 px-2 text-center">Items</th>
                    <th className="py-1.5 px-2 text-center">Clips</th>
                    <th className="py-1.5 px-2 text-right">Runtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y mac-border">
                  {analytics.dates.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-1.5 px-2 font-mono font-bold text-purple-300 truncate max-w-[110px]" title={d.dateLabel}>
                        {d.dateLabel}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-gray-400">
                        {d.itemCount}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-gray-400">
                        {d.clipCount}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-amber-300">
                        {formatCumulativeDuration(d.duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Adobe Premiere Pro Generator Card ── */}
        <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" /> Adobe Premiere Pro
            </span>
            <span className="text-[10px] text-purple-400 font-mono">
              {analytics?.hasPrproj ? 'Project Exists' : 'Pending'}
            </span>
          </div>

          <div className="text-xs text-[var(--mac-text-secondary)]">
            Automatically place all raw clips end-to-end on V1/A1 with frame-accurate sync and standardized production bins.
          </div>

          <button
            onClick={() => setIsPreflightOpen(true)}
            disabled={!analytics || analytics.videoClipCount === 0}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Pre-Flight & Generate Project</span>
          </button>
        </div>

        {/* ── One Tap Ecosystem Integrations ── */}
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider block">
            One Tap Ecosystem
          </span>

          {oneTapStats && (
            <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border mac-border space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--mac-text-muted)] text-[11px]">Tracker Stage:</span>
                <span className="font-semibold text-emerald-400">{oneTapStats.stage || 'In Progress'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--mac-text-muted)] text-[11px]">Completed Renders:</span>
                <span className="font-semibold text-[var(--mac-text-primary)]">{oneTapStats.rendersCount || 0}</span>
              </div>
              {oneTapStats.totalRenderDuration > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--mac-text-muted)] text-[11px]">Render Compute Time:</span>
                  <span className="font-mono text-[var(--mac-text-secondary)]">{Math.round(oneTapStats.totalRenderDuration)}s</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSeparatePV}
            className="w-full py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border mac-border text-[var(--mac-text-primary)] rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Separate Photos & Videos (PV)</span>
          </button>

          {actionFeedback && (
            <div className="text-center text-[10.5px] font-semibold text-emerald-400 animate-in fade-in">
              {actionFeedback}
            </div>
          )}
        </div>
      </div>

      {/* ── Preflight Modal ── */}
      <PremierePreflightModal
        isOpen={isPreflightOpen}
        onClose={() => setIsPreflightOpen(false)}
        folderPath={folderPath}
        folderName={folderName}
        folderType={analytics?.folderType || 'generic'}
        videoClipCount={analytics?.videoClipCount || 0}
        cumulativeDuration={analytics?.cumulativeDurationSeconds || 0}
        onSuccess={() => {
          setIsPreflightOpen(false);
          fetchAnalytics();
        }}
      />
    </div>
  );
};
