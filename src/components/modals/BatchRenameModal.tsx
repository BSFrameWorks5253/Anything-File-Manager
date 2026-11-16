import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Edit3,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Undo2,
  RefreshCw,
  Hash,
  Sliders,
  Sparkles,
  FileText
} from 'lucide-react';
import { FsItem } from '../../types';
import { mediaService } from '../../services';
import { formatBytes } from '../../utils';

interface BatchRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: FsItem[];
  onSuccess: () => void;
}

type PlacementMode =
  | 'End'
  | 'Start'
  | 'Middle'
  | 'Start & Middle'
  | 'Middle & End'
  | 'Start & End'
  | 'Find & Replace'
  | 'Custom Pattern';

type PaddingMode = 'None' | 'Auto' | '2' | '3' | '4' | '5';
type CaseMode = 'Keep Original' | 'UPPERCASE' | 'lowercase' | 'Title Case';
type ExtMode = 'Keep Original' | 'lowercase' | 'UPPERCASE';

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  isOpen,
  onClose,
  items,
  onSuccess
}) => {
  // Placement & Names
  const [placement, setPlacement] = useState<PlacementMode>('End');
  const [baseName, setBaseName] = useState('Clip');
  const [part1, setPart1] = useState('CAM_A');
  const [part2, setPart2] = useState('TAKE');

  // Find & Replace
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Custom Pattern
  const [customPattern, setCustomPattern] = useState('{orig}_{seq}');

  // Numbering / Sequence
  const [startSeq, setStartSeq] = useState(1);
  const [step, setStep] = useState(1);
  const [padding, setPadding] = useState<PaddingMode>('3');
  const [separator, setSeparator] = useState('_');

  // Formatting
  const [caseMode, setCaseMode] = useState<CaseMode>('Keep Original');
  const [extMode, setExtMode] = useState<ExtMode>('lowercase');

  // Execution & Undo State
  const [isApplying, setIsApplying] = useState(false);
  const [lastHistoryId, setLastHistoryId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live preview for all items
  const previewItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    const total = items.length;
    const usedNames = new Set<string>();

    return items.map((item, idx) => {
      const origExt = item.name.includes('.') ? item.name.slice(item.name.lastIndexOf('.')) : '';
      const origStem = origExt ? item.name.slice(0, -origExt.length) : item.name;

      // 1. Calculate sequence string
      const seqNum = startSeq + idx * step;
      let width = 0;
      if (padding === 'Auto') width = Math.max(2, String(total).length);
      else if (padding === '2') width = 2;
      else if (padding === '3') width = 3;
      else if (padding === '4') width = 4;
      else if (padding === '5') width = 5;

      const seqStr = width > 0 ? String(seqNum).padStart(width, '0') : String(seqNum);

      // 2. Generate Stem Body
      let body = '';
      const sep = separator;

      if (placement === 'Start') {
        body = baseName ? `${seqStr}${sep}${baseName}` : seqStr;
      } else if (placement === 'End') {
        body = baseName ? `${baseName}${sep}${seqStr}` : seqStr;
      } else if (placement === 'Middle') {
        const tokens = [part1, seqStr, part2].filter(Boolean);
        body = tokens.join(sep);
      } else if (placement === 'Start & Middle') {
        const tokens = [seqStr, part1, seqStr, part2].filter(Boolean);
        body = tokens.join(sep);
      } else if (placement === 'Middle & End') {
        const tokens = [part1, seqStr, part2, seqStr].filter(Boolean);
        body = tokens.join(sep);
      } else if (placement === 'Start & End') {
        const tokens = [seqStr, baseName, seqStr].filter(Boolean);
        body = tokens.join(sep);
      } else if (placement === 'Find & Replace') {
        if (!findText) {
          body = origStem;
        } else {
          try {
            if (isRegex) {
              const regex = new RegExp(findText, caseSensitive ? 'g' : 'gi');
              body = origStem.replace(regex, replaceText);
            } else {
              const flags = caseSensitive ? 'g' : 'gi';
              const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              body = origStem.replace(new RegExp(escaped, flags), replaceText);
            }
          } catch {
            body = origStem;
          }
        }
      } else if (placement === 'Custom Pattern') {
        let pat = customPattern;
        pat = pat.replace(/\{name\}/g, baseName);
        pat = pat.replace(/\{part1\}/g, part1);
        pat = pat.replace(/\{part2\}/g, part2);
        pat = pat.replace(/\{orig\}/g, origStem);
        pat = pat.replace(/\{seq\}/g, seqStr);
        pat = pat.replace(/\{sep\}/g, sep);
        body = pat;
      }

      // 3. Case Conversion
      if (caseMode === 'UPPERCASE') body = body.toUpperCase();
      else if (caseMode === 'lowercase') body = body.toLowerCase();
      else if (caseMode === 'Title Case') {
        body = body.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
      }

      // Sanitize illegal OS characters: < > : " / \ | ? *
      body = body.replace(/[<>:"/\\|?*]/g, '').trim();
      if (!body) body = `file_${seqStr}`;

      // 4. Extension handling
      let finalExt = origExt;
      if (extMode === 'lowercase') finalExt = origExt.toLowerCase();
      else if (extMode === 'UPPERCASE') finalExt = origExt.toUpperCase();

      const newName = `${body}${finalExt}`;

      // 5. Collision Status
      let status: 'Ready' | 'Collision' | 'Unchanged' = 'Ready';
      if (newName === item.name) {
        status = 'Unchanged';
      } else if (usedNames.has(newName.toLowerCase())) {
        status = 'Collision';
      }
      usedNames.add(newName.toLowerCase());

      return {
        item,
        originalName: item.name,
        newName,
        status,
        size: item.size
      };
    });
  }, [
    items,
    placement,
    baseName,
    part1,
    part2,
    findText,
    replaceText,
    isRegex,
    caseSensitive,
    customPattern,
    startSeq,
    step,
    padding,
    separator,
    caseMode,
    extMode
  ]);

  const hasCollision = useMemo(() => {
    return previewItems.some(i => i.status === 'Collision');
  }, [previewItems]);

  const handleApply = async () => {
    if (hasCollision) {
      alert('Cannot rename: Name collisions detected. Please adjust numbers, base name, or pattern.');
      return;
    }

    const operations = previewItems
      .filter(i => i.originalName !== i.newName)
      .map(i => ({
        oldPath: i.item.fullPath,
        newName: i.newName
      }));

    if (operations.length === 0) {
      onClose();
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);

    const res = await mediaService.batchRename(operations);
    setIsApplying(false);

    if (res.ok) {
      if (res.historyId) setLastHistoryId(res.historyId);
      setStatusMessage(`Successfully renamed ${res.renamedCount} items!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } else {
      setErrorMessage(res.error || 'Batch rename failed');
    }
  };

  const handleUndo = async () => {
    if (!lastHistoryId) return;
    setIsApplying(true);
    const res = await mediaService.undoBatchRename(lastHistoryId);
    setIsApplying(false);
    if (res.ok) {
      setLastHistoryId(null);
      setStatusMessage(`Reverted ${res.revertedCount} items.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } else {
      setErrorMessage(res.error || 'Undo failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-neutral-900 border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 font-sans"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Batch Renamer Engine
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                  {items.length} items selected
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Safe 2-pass sequence renaming with live collision prevention and instant undo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastHistoryId && (
              <button
                onClick={handleUndo}
                disabled={isApplying}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-neutral-200 border border-white/10 flex items-center gap-1.5 transition-colors"
                title="Undo last rename"
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Undo Last Rename</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Renaming Configuration Controls ── */}
        <div className="p-5 border-b border-white/10 bg-neutral-900/90 flex flex-col gap-4 overflow-y-auto max-h-72">
          {/* Mode Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/10 text-xs">
            {(
              [
                'End',
                'Start',
                'Middle',
                'Start & Middle',
                'Middle & End',
                'Find & Replace',
                'Custom Pattern'
              ] as PlacementMode[]
            ).map(m => (
              <button
                key={m}
                onClick={() => setPlacement(m)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  placement === m
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Mode-Specific Input Fields */}
          {placement === 'Find & Replace' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Find Text
                </label>
                <input
                  type="text"
                  value={findText}
                  onChange={e => setFindText(e.target.value)}
                  placeholder="e.g. DJI_ or CLIP_"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Replace With
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                  placeholder="e.g. AERIAL_ or TAKE_01_"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-center gap-4 col-span-full pt-1 text-xs text-neutral-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={e => setCaseSensitive(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span>Match Case</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRegex}
                    onChange={e => setIsRegex(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span>Regular Expression</span>
                </label>
              </div>
            </div>
          ) : placement === 'Custom Pattern' ? (
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Custom Pattern Format
              </label>
              <input
                type="text"
                value={customPattern}
                onChange={e => setCustomPattern(e.target.value)}
                placeholder="{orig}_{seq} or {name}_{part1}_{seq}"
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400 mb-1.5"
              />
              <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-400 font-mono">
                <span className="text-neutral-500">Available tokens:</span>
                {['{orig}', '{seq}', '{name}', '{part1}', '{part2}', '{sep}'].map(tok => (
                  <button
                    key={tok}
                    onClick={() => setCustomPattern(prev => `${prev}${tok}`)}
                    className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-amber-300 border border-white/10"
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  {placement === 'Middle' || placement.includes('Middle') ? 'Prefix (Part 1)' : 'Base Name'}
                </label>
                <input
                  type="text"
                  value={placement.includes('Middle') ? part1 : baseName}
                  onChange={e => {
                    if (placement.includes('Middle')) setPart1(e.target.value);
                    else setBaseName(e.target.value);
                  }}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {placement.includes('Middle') && (
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Suffix (Part 2)
                  </label>
                  <input
                    type="text"
                    value={part2}
                    onChange={e => setPart2(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Separator
                </label>
                <select
                  value={separator}
                  onChange={e => setSeparator(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="_">Underscore ( _ )</option>
                  <option value="-">Hyphen ( - )</option>
                  <option value=" ">Space (   )</option>
                  <option value=".">Dot ( . )</option>
                  <option value="">None</option>
                </select>
              </div>
            </div>
          )}

          {/* Sequence & Padding Row */}
          {placement !== 'Find & Replace' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-white/10 text-xs">
              <div>
                <label className="text-[11px] font-bold text-neutral-400 block mb-1">Start At</label>
                <input
                  type="number"
                  value={startSeq}
                  onChange={e => setStartSeq(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-400 block mb-1">Step (+)</label>
                <input
                  type="number"
                  value={step}
                  onChange={e => setStep(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-400 block mb-1">Zero Padding</label>
                <select
                  value={padding}
                  onChange={e => setPadding(e.target.value as PaddingMode)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1 text-white"
                >
                  <option value="Auto">Auto-width</option>
                  <option value="2">2 Digits (01)</option>
                  <option value="3">3 Digits (001)</option>
                  <option value="4">4 Digits (0001)</option>
                  <option value="5">5 Digits (00001)</option>
                  <option value="None">None (1, 2, 3)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-400 block mb-1">Case Format</label>
                <select
                  value={caseMode}
                  onChange={e => setCaseMode(e.target.value as CaseMode)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-1 text-white"
                >
                  <option value="Keep Original">Keep Original</option>
                  <option value="UPPERCASE">UPPERCASE</option>
                  <option value="lowercase">lowercase</option>
                  <option value="Title Case">Title Case</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Live Diff Table ── */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-neutral-950/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 flex items-center justify-between">
            <span>Live Rename Preview ({previewItems.length} files)</span>
            {hasCollision && (
              <span className="text-rose-400 flex items-center gap-1 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> Collision detected!
              </span>
            )}
          </div>

          <div className="border border-white/10 rounded-2xl overflow-hidden shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-neutral-400 font-mono text-[10px] uppercase">
                  <th className="py-2 px-3 w-10 text-center">#</th>
                  <th className="py-2 px-3">Original Filename</th>
                  <th className="py-2 px-3 w-6 text-center"></th>
                  <th className="py-2 px-3">New Filename</th>
                  <th className="py-2 px-3 w-20 text-right">Size</th>
                  <th className="py-2 px-3 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {previewItems.map((p, idx) => {
                  const isChanged = p.originalName !== p.newName;
                  return (
                    <tr
                      key={p.item.fullPath}
                      className={`hover:bg-white/5 transition-colors ${
                        p.status === 'Collision'
                          ? 'bg-rose-500/10'
                          : isChanged
                          ? 'bg-amber-500/5'
                          : ''
                      }`}
                    >
                      <td className="py-1.5 px-3 text-center text-neutral-500">{idx + 1}</td>
                      <td className="py-1.5 px-3 text-neutral-300 truncate max-w-xs" title={p.originalName}>
                        {p.originalName}
                      </td>
                      <td className="py-1.5 px-3 text-center text-neutral-500">
                        <ArrowRight className="w-3.5 h-3.5 inline" />
                      </td>
                      <td
                        className={`py-1.5 px-3 font-semibold truncate max-w-xs ${
                          p.status === 'Collision'
                            ? 'text-rose-400'
                            : isChanged
                            ? 'text-amber-300'
                            : 'text-neutral-500'
                        }`}
                        title={p.newName}
                      >
                        {p.newName}
                      </td>
                      <td className="py-1.5 px-3 text-right text-neutral-400">
                        {formatBytes(p.size)}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        {p.status === 'Collision' ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                            Collision
                          </span>
                        ) : isChanged ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            Ready
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[10px]">Unchanged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/10 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            {errorMessage ? (
              <span className="text-rose-400 font-medium">{errorMessage}</span>
            ) : statusMessage ? (
              <span className="text-emerald-400 font-medium">{statusMessage}</span>
            ) : (
              <span>Two-pass renaming guarantees no files overwrite each other.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || hasCollision}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-black shadow-lg flex items-center gap-1.5 transition-all ${
                hasCollision
                  ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed opacity-50'
                  : 'bg-amber-400 hover:bg-amber-300 active:scale-95'
              }`}
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Renaming...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Rename {previewItems.filter(i => i.originalName !== i.newName).length} Items</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
