import React from 'react';
import {
  HardDrive,
  Home,
  Monitor,
  Download,
  Image as ImageIcon,
  Film,
  FileText,
  Clock,
  Sparkles,
  Tag,
  X
} from 'lucide-react';
import { FsItem, QuickAccessItem, DriveInfo, FilterCategory } from '../../types';
import { formatBytes } from '../../utils';
import { MacFolderIcon } from '../common/MacIcons';

export const APPLE_TAGS = [
  { id: 'red', label: 'Red', color: '#EF4444' },
  { id: 'orange', label: 'Orange', color: '#F97316' },
  { id: 'yellow', label: 'Yellow', color: '#EAB308' },
  { id: 'green', label: 'Green', color: '#10B981' },
  { id: 'blue', label: 'Blue', color: '#3B82F6' },
  { id: 'purple', label: 'Purple', color: '#8B5CF6' },
  { id: 'gray', label: 'Gray', color: '#6B7280' }
];

interface ExplorerSidebarProps {
  quickAccess: QuickAccessItem[];
  drivesWithSpace: DriveInfo[];
  currentPath: string;
  subfolders?: FsItem[];
  filterCategory: FilterCategory;
  onSetFilterCategory: (cat: FilterCategory) => void;
  onSelectPath: (path: string) => void;
  width?: number;
  colorTags?: Record<string, string>;
  selectedTagColor?: string | null;
  onSelectTagColor?: (color: string | null) => void;
  onDropItems?: (targetDir: string, items: string[], op: 'copy' | 'move') => void;
}

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({
  quickAccess,
  drivesWithSpace,
  currentPath,
  filterCategory,
  onSetFilterCategory,
  onSelectPath,
  width = 240,
  colorTags = {},
  selectedTagColor = null,
  onSelectTagColor,
  onDropItems
}) => {
  const [springHoverPath, setSpringHoverPath] = React.useState<string | null>(null);
  const springTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragOverItem = (e: React.DragEvent, fullPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';

    if (springHoverPath !== fullPath) {
      setSpringHoverPath(fullPath);
      if (springTimerRef.current) clearTimeout(springTimerRef.current);
      springTimerRef.current = setTimeout(() => {
        onSelectPath(fullPath);
        setSpringHoverPath(null);
      }, 500); // 500ms spring-loaded folder delay
    }
  };

  const handleDragLeaveItem = (e: React.DragEvent, fullPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (springHoverPath === fullPath) {
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      setSpringHoverPath(null);
    }
  };

  const handleDropOnItem = async (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    setSpringHoverPath(null);

    let droppedPaths: string[] = [];
    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const p = JSON.parse(jsonStr);
        if (Array.isArray(p)) droppedPaths = p;
      } catch {}
    }
    if (droppedPaths.length === 0) {
      const text = e.dataTransfer.getData('text/plain');
      if (text) droppedPaths = [text];
    }
    droppedPaths = droppedPaths.filter(p => p !== targetDir);
    if (droppedPaths.length > 0) {
      const op = e.altKey ? 'copy' : 'move';
      if (onDropItems) {
        onDropItems(targetDir, droppedPaths, op);
      } else {
        await mediaService.clipboardPaste(targetDir, droppedPaths, op);
      }
    }
  };
  const getIconForQuickAccess = (icon: string) => {
    switch (icon) {
      case 'home':
        return <Home className="w-4 h-4 text-sky-500" />;
      case 'desktop':
        return <Monitor className="w-4 h-4 text-sky-500" />;
      case 'downloads':
        return <Download className="w-4 h-4 text-sky-500" />;
      case 'pictures':
        return <ImageIcon className="w-4 h-4 text-cyan-500" />;
      case 'videos':
        return <Film className="w-4 h-4 text-purple-500" />;
      case 'documents':
        return <FileText className="w-4 h-4 text-amber-500" />;
      default:
        return <MacFolderIcon size={16} />;
    }
  };

  const isPathActive = (p: string) => {
    if (!currentPath || !p) return false;
    const normCur = currentPath.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
    const normP = p.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
    return normCur === normP;
  };

  // Count tags in current view or system
  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const color of Object.values(colorTags)) {
      counts[color.toLowerCase()] = (counts[color.toLowerCase()] || 0) + 1;
    }
    return counts;
  }, [colorTags]);

  return (
    <div
      style={{ width: `${width}px` }}
      className="flex-shrink-0 border-r mac-sidebar overflow-y-auto flex flex-col p-3 select-none text-[var(--mac-text-primary)] transition-colors duration-200"
    >
      {/* ── Section 1: Favorites (Apple macOS Finder Standard) ── */}
      <div className="px-2 pt-1 pb-1.5 text-[10.5px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider flex items-center justify-between">
        <span>Favorites</span>
      </div>
      <div className="space-y-0.5 mb-4">
        {quickAccess.map(item => {
          const active = isPathActive(item.path);
          const isSpringTarget = springHoverPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                onSelectTagColor?.(null);
                onSelectPath(item.path);
              }}
              onDragOver={e => handleDragOverItem(e, item.path)}
              onDragLeave={e => handleDragLeaveItem(e, item.path)}
              onDrop={e => handleDropOnItem(e, item.path)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSpringTarget
                  ? 'mac-spring-target'
                  : active && !selectedTagColor
                  ? 'bg-[var(--mac-accent)] text-white shadow-sm font-semibold'
                  : 'text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
              }`}
            >
              {getIconForQuickAccess(item.icon)}
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* ── Section 2: Locations & Drives (macOS Finder Style) ── */}
      <div className="px-2 pb-1.5 text-[10.5px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider flex items-center justify-between">
        <span>Locations</span>
      </div>
      <div className="space-y-1 mb-4">
        {drivesWithSpace.map(d => {
          const active = currentPath.toLowerCase().startsWith(d.drive.toLowerCase());
          const isSpringTarget = springHoverPath === d.drive;
          return (
            <button
              key={d.drive}
              onClick={() => {
                onSelectTagColor?.(null);
                onSelectPath(d.drive);
              }}
              onDragOver={e => handleDragOverItem(e, d.drive)}
              onDragLeave={e => handleDragLeaveItem(e, d.drive)}
              onDrop={e => handleDropOnItem(e, d.drive)}
              className={`w-full flex flex-col p-2 rounded-xl text-xs transition-all ${
                isSpringTarget
                  ? 'mac-spring-target'
                  : active && !selectedTagColor
                  ? 'bg-blue-600/15 border border-blue-500/40 text-blue-300'
                  : 'border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2 font-semibold">
                  <HardDrive className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span className="truncate">{d.drive.replace(/\\/g, '')}</span>
                </div>
                {d.total > 0 && (
                  <span className="text-[10px] text-[var(--mac-text-muted)] font-mono">
                    {formatBytes(d.free)} free
                  </span>
                )}
              </div>
              {d.total > 0 && (
                <div className="w-full bg-black/10 dark:bg-white/10 h-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      d.usedPercent > 90
                        ? 'bg-rose-500'
                        : d.usedPercent > 75
                        ? 'bg-amber-400'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${d.usedPercent}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Section 3: macOS Finder Color Tags ── */}
      <div className="px-2 pb-1.5 text-[10.5px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider flex items-center justify-between">
        <span>Tags</span>
        {selectedTagColor && (
          <button
            onClick={() => onSelectTagColor?.(null)}
            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-0.5 lowercase tracking-normal"
            title="Clear tag filter"
          >
            <X className="w-3 h-3" />
            <span>clear</span>
          </button>
        )}
      </div>
      <div className="space-y-0.5 mb-4">
        {APPLE_TAGS.map(t => {
          const isSelected = selectedTagColor?.toLowerCase() === t.color.toLowerCase();
          const count = tagCounts[t.color.toLowerCase()] || 0;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTagColor?.(isSelected ? null : t.color)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-[#007AFF] text-white font-semibold shadow-xs'
                  : 'text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  style={{ backgroundColor: t.color }}
                  className={`w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0 ${
                    isSelected ? 'ring-2 ring-white' : 'ring-1 ring-white/30'
                  }`}
                />
                <span>{t.label}</span>
              </div>
              {count > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-black/10 dark:bg-white/10 text-[var(--mac-text-muted)]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Section 4: Smart Media Filters ── */}
      <div className="px-2 pb-1.5 text-[10.5px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider flex items-center justify-between">
        <span>Media Types</span>
      </div>
      <div className="space-y-0.5">
        <button
          onClick={() => {
            onSelectTagColor?.(null);
            onSetFilterCategory('all');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'all' && !selectedTagColor
              ? 'bg-black/10 dark:bg-white/10 text-[var(--mac-text-primary)] font-semibold'
              : 'text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>All Items</span>
          </div>
        </button>
        <button
          onClick={() => {
            onSelectTagColor?.(null);
            onSetFilterCategory('photo');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'photo'
              ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30'
              : 'text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Photos & Raw</span>
          </div>
        </button>
        <button
          onClick={() => {
            onSelectTagColor?.(null);
            onSetFilterCategory('video');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'video'
              ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30'
              : 'text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Videos</span>
          </div>
        </button>
        <button
          onClick={() => {
            onSelectTagColor?.(null);
            onSetFilterCategory('timelapse');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'timelapse'
              ? 'bg-amber-600/20 text-amber-300 font-semibold border border-amber-500/30'
              : 'text-[var(--mac-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Timelapses (&lt; 60s)</span>
          </div>
        </button>
      </div>
    </div>
  );
};
