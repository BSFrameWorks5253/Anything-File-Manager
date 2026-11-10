import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Folder,
  HardDrive,
  Clock,
  ArrowRight,
  CornerDownLeft,
  X,
  FileCode,
  Film,
  Image as ImageIcon,
  Compass,
  Zap,
  Layers,
  Sparkles
} from 'lucide-react';
import { FsItem } from '../../types';
import { MacFolderIcon } from '../common/MacIcons';
import { isVideoExtension, isPhotoExtension, formatBytes } from '../../utils';
import { classifyFolder } from '../../utils/afmTaxonomy';

interface FuzzyJumpPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  currentItems: FsItem[];
  quickAccess: { name: string; path: string }[];
  drivesWithSpace: { drive: string; free: number; total: number; label?: string }[];
  onNavigate: (targetPath: string) => void;
  onOpenItem?: (item: FsItem) => void;
}

interface JumpCandidate {
  id: string;
  name: string;
  fullPath: string;
  category: 'slot' | 'session' | 'subfolder' | 'drive' | 'quick' | 'recent' | 'file';
  categoryLabel: string;
  subtitle?: string;
  iconType?: string;
  clipCount?: number;
  size?: number;
}

export const FuzzyJumpPalette: React.FC<FuzzyJumpPaletteProps> = ({
  isOpen,
  onClose,
  currentPath,
  currentItems,
  quickAccess,
  drivesWithSpace,
  onNavigate,
  onOpenItem
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'folders' | 'slots' | 'drives' | 'recents'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Recent visited locations stored in localStorage
  const recentPaths = useMemo<string[]>(() => {
    try {
      const stored = localStorage.getItem('afm_recent_locations');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  }, [isOpen]);

  // Record current location to recent history
  useEffect(() => {
    if (currentPath) {
      try {
        const stored = localStorage.getItem('afm_recent_locations');
        let arr: string[] = stored ? JSON.parse(stored) : [];
        arr = arr.filter(p => p !== currentPath);
        arr.unshift(currentPath);
        if (arr.length > 20) arr = arr.slice(0, 20);
        localStorage.setItem('afm_recent_locations', JSON.stringify(arr));
      } catch {}
    }
  }, [currentPath]);

  // Focus input automatically whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedFilter('all');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Build candidate pool
  const allCandidates = useMemo<JumpCandidate[]>(() => {
    const list: JumpCandidate[] = [];
    const seen = new Set<string>();

    // 1. Current directory subfolders
    for (const item of currentItems) {
      if (seen.has(item.fullPath)) continue;
      seen.add(item.fullPath);

      if (item.isDir) {
        const classification = classifyFolder(item.name, item.fullPath);
        let category: JumpCandidate['category'] = 'subfolder';
        let categoryLabel = 'Subfolder';

        if (classification.type === 'slot_item_a' || classification.type === 'slot_item_b') {
          category = 'slot';
          categoryLabel = `Slot ${classification.slotTokens?.slotNo || ''} (${classification.slotTokens?.eventCode || 'CAM'})`;
        } else if (classification.type === 'date_session') {
          category = 'session';
          categoryLabel = `Date Session (${classification.dateTokens?.sessionPeriod || 'M'})`;
        } else if (classification.type === 'master_safar') {
          category = 'session';
          categoryLabel = `Master Safar (${classification.masterTokens?.city || ''})`;
        }

        list.push({
          id: `curr-${item.fullPath}`,
          name: item.name,
          fullPath: item.fullPath,
          category,
          categoryLabel,
          subtitle: item.fullPath,
          size: item.size
        });
      }
    }

    // 2. Drives & Volumes
    for (const drive of drivesWithSpace) {
      if (seen.has(drive.drive)) continue;
      seen.add(drive.drive);
      const freeStr = drive.free > 0 ? `${formatBytes(drive.free)} free of ${formatBytes(drive.total)}` : '';
      list.push({
        id: `drive-${drive.drive}`,
        name: drive.label ? `${drive.label} (${drive.drive})` : `Volume (${drive.drive})`,
        fullPath: drive.drive,
        category: 'drive',
        categoryLabel: 'Mounted Drive',
        subtitle: freeStr || drive.drive
      });
    }

    // 3. Quick Access / Favorites
    for (const qa of quickAccess) {
      if (seen.has(qa.path)) continue;
      seen.add(qa.path);
      list.push({
        id: `qa-${qa.path}`,
        name: qa.name,
        fullPath: qa.path,
        category: 'quick',
        categoryLabel: 'Favorite Place',
        subtitle: qa.path
      });
    }

    // 4. Recent locations
    for (const rec of recentPaths) {
      if (seen.has(rec)) continue;
      seen.add(rec);
      const segs = rec.split(/[\\/]/).filter(Boolean);
      const baseName = segs[segs.length - 1] || rec;
      const classification = classifyFolder(baseName, rec);
      let category: JumpCandidate['category'] = 'recent';
      let categoryLabel = 'Recent History';

      if (classification.type === 'slot_item_a' || classification.type === 'slot_item_b') {
        category = 'slot';
        categoryLabel = 'Recent Slot';
      } else if (classification.type === 'date_session' || classification.type === 'master_safar') {
        category = 'session';
        categoryLabel = 'Recent Session';
      }

      list.push({
        id: `rec-${rec}`,
        name: baseName,
        fullPath: rec,
        category,
        categoryLabel,
        subtitle: rec
      });
    }

    // 5. Direct media files in current directory
    for (const item of currentItems) {
      if (item.isDir || seen.has(item.fullPath)) continue;
      if (isVideoExtension(item.ext) || isPhotoExtension(item.ext)) {
        seen.add(item.fullPath);
        list.push({
          id: `file-${item.fullPath}`,
          name: item.name,
          fullPath: item.fullPath,
          category: 'file',
          categoryLabel: isVideoExtension(item.ext) ? 'Video Clip' : 'Photo',
          subtitle: formatBytes(item.size),
          size: item.size
        });
      }
    }

    return list;
  }, [currentItems, drivesWithSpace, quickAccess, recentPaths]);

  // Filtered & Scored Candidates
  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    let candidates = allCandidates;

    if (selectedFilter === 'folders') {
      candidates = candidates.filter(c => c.category === 'subfolder');
    } else if (selectedFilter === 'slots') {
      candidates = candidates.filter(c => c.category === 'slot' || c.category === 'session');
    } else if (selectedFilter === 'drives') {
      candidates = candidates.filter(c => c.category === 'drive' || c.category === 'quick');
    } else if (selectedFilter === 'recents') {
      candidates = candidates.filter(c => c.category === 'recent');
    }

    if (!q) {
      return candidates.slice(0, 40);
    }

    // Direct path detection: if user types "C:\" or "/Volumes"
    const isDirectPath = /^[a-zA-Z]:[\\/]/i.test(query.trim()) || query.trim().startsWith('/');

    // Match scoring
    const scored = candidates.map(c => {
      const nameLower = c.name.toLowerCase();
      const pathLower = c.fullPath.toLowerCase();

      let score = 0;
      if (nameLower === q) score += 100;
      else if (nameLower.startsWith(q)) score += 50;
      else if (nameLower.includes(q)) score += 30;
      else if (pathLower.includes(q)) score += 15;

      // Bonus for slot matches e.g. "01m", "01-z", "cam"
      if ((c.category === 'slot' || c.category === 'session') && (nameLower.includes(q) || pathLower.includes(q))) {
        score += 20;
      }

      return { candidate: c, score };
    }).filter(s => s.score > 0);

    scored.sort((a, b) => b.score - a.score);

    const results = scored.map(s => s.candidate);

    // If direct path was typed and not already in list, prepend synthetic direct path jump
    if (isDirectPath && !results.some(r => r.fullPath.toLowerCase() === query.trim().toLowerCase())) {
      results.unshift({
        id: `direct-${query.trim()}`,
        name: query.trim(),
        fullPath: query.trim(),
        category: 'quick',
        categoryLabel: 'Go to Path Directly',
        subtitle: 'Press Enter to open this filesystem path'
      });
    }

    return results.slice(0, 50);
  }, [allCandidates, query, selectedFilter]);

  // Ensure selectedIndex is in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCandidates.length) {
      setSelectedIndex(Math.max(0, filteredCandidates.length - 1));
    }
  }, [filteredCandidates.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelectCandidate = (candidate: JumpCandidate) => {
    if (candidate.category === 'file' && onOpenItem) {
      const fItem = currentItems.find(i => i.fullPath === candidate.fullPath);
      if (fItem) {
        onOpenItem(fItem);
        onClose();
        return;
      }
    }
    onNavigate(candidate.fullPath);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredCandidates.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredCandidates.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCandidates.length > 0) {
        handleSelectCandidate(filteredCandidates[selectedIndex]);
      } else if (query.trim()) {
        // Direct jump to whatever string was typed
        onNavigate(query.trim());
        onClose();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredCandidates.length > 0) {
        setQuery(filteredCandidates[selectedIndex].fullPath);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-md flex items-start justify-center pt-24 px-4 select-none animate-in fade-in duration-150"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl bg-white/95 dark:bg-[#161823]/95 border border-black/10 dark:border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in zoom-in-95 duration-150 text-[var(--mac-text-primary)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Spotlight Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/10 dark:border-white/10 bg-transparent">
          <Search className="w-5 h-5 text-[var(--mac-accent)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Go to folder, slot, date, or path... (e.g. 01M, 01-Z, 1448, London)"
            className="w-full bg-transparent text-base font-medium placeholder-[var(--mac-text-muted)] text-[var(--mac-text-primary)] outline-none"
          />
          {query ? (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--mac-text-muted)] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded border border-black/5 dark:border-white/10">
              <span>ESC</span>
            </div>
          )}
        </div>

        {/* Quick Filter Segmented Chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-xs">
          <button
            onClick={() => { setSelectedFilter('all'); setSelectedIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-[var(--mac-accent)] text-white shadow-xs'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setSelectedFilter('slots'); setSelectedIndex(0); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedFilter === 'slots'
                ? 'bg-[var(--mac-accent)] text-white shadow-xs'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>🎯</span>
            <span>Slots &amp; Dates</span>
          </button>
          <button
            onClick={() => { setSelectedFilter('folders'); setSelectedIndex(0); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedFilter === 'folders'
                ? 'bg-[var(--mac-accent)] text-white shadow-xs'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>📁</span>
            <span>Subfolders</span>
          </button>
          <button
            onClick={() => { setSelectedFilter('drives'); setSelectedIndex(0); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedFilter === 'drives'
                ? 'bg-[var(--mac-accent)] text-white shadow-xs'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>💾</span>
            <span>Drives &amp; Places</span>
          </button>
          <button
            onClick={() => { setSelectedFilter('recents'); setSelectedIndex(0); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedFilter === 'recents'
                ? 'bg-[var(--mac-accent)] text-white shadow-xs'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>⏱️</span>
            <span>Recents</span>
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 flex flex-col gap-1">
          {filteredCandidates.length === 0 ? (
            <div className="py-12 text-center text-[var(--mac-text-muted)] flex flex-col items-center justify-center gap-2">
              <Compass className="w-8 h-8 opacity-30" />
              <div className="text-sm font-semibold">No matching directories or items found</div>
              <div className="text-xs">Type a full path (e.g. C:\...) and press Enter to navigate directly.</div>
            </div>
          ) : (
            filteredCandidates.map((candidate, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={candidate.id}
                  data-active={isSelected}
                  onClick={() => handleSelectCandidate(candidate)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-100 ${
                    isSelected
                      ? 'bg-[var(--mac-accent)] text-white shadow-sm'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--mac-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {candidate.category === 'drive' ? (
                        <HardDrive className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
                      ) : candidate.category === 'slot' ? (
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          🎯
                        </div>
                      ) : candidate.category === 'session' ? (
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-400'}`}>
                          📅
                        </div>
                      ) : candidate.category === 'file' ? (
                        <Film className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-amber-400'}`} />
                      ) : (
                        <MacFolderIcon size={20} />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate max-w-[320px]">
                          {candidate.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? 'bg-white/20 border-white/30 text-white'
                              : 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10 text-[var(--mac-text-muted)]'
                          }`}
                        >
                          {candidate.categoryLabel}
                        </span>
                      </div>
                      {candidate.subtitle && (
                        <span
                          className={`text-xs truncate max-w-[420px] font-mono ${
                            isSelected ? 'text-white/80' : 'text-[var(--mac-text-muted)]'
                          }`}
                        >
                          {candidate.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {isSelected && (
                      <div className="flex items-center gap-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-md text-white font-medium">
                        <span>Jump</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-[var(--mac-text-muted)] font-medium">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select / Open</span>
            <span>Tab Complete</span>
            <span>Esc Close</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <span>{filteredCandidates.length} matches</span>
          </div>
        </div>
      </div>
    </div>
  );
};
