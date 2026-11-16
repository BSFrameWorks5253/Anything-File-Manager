import React from 'react';
import {
  Folder,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Copy,
  Move,
  RefreshCw,
  HardDrive,
  ExternalLink,
  ChevronRight,
  ArrowUp
} from 'lucide-react';
import { FsItem, ViewMode } from '../../types';
import { ExplorerGrid } from './ExplorerGrid';
import { ExplorerTable } from './ExplorerTable';
import { MacFolderIcon } from '../common/MacIcons';

interface DualPaneSplitViewProps {
  // Left Pane
  leftPath: string;
  leftItems: FsItem[];
  leftLoading: boolean;
  leftSelectedPath: string | null;
  leftSelectedPaths: Set<string>;
  onSelectLeftItem: (item: FsItem, e?: React.MouseEvent) => void;
  onOpenLeftItem: (item: FsItem) => void;
  onNavigateLeft: (path: string) => void;

  // Right Pane
  rightPath: string;
  rightItems: FsItem[];
  rightLoading: boolean;
  rightSelectedPath: string | null;
  rightSelectedPaths: Set<string>;
  onSelectRightItem: (item: FsItem, e?: React.MouseEvent) => void;
  onOpenRightItem: (item: FsItem) => void;
  onNavigateRight: (path: string) => void;

  // Active state
  activePane: 'left' | 'right';
  onSetActivePane: (pane: 'left' | 'right') => void;

  // Operations
  onCopyLeftToRight: () => void;
  onMoveLeftToRight: () => void;
  onCopyRightToLeft: () => void;
  onMoveRightToLeft: () => void;
  onMirrorPath: () => void;
  onSwapPanes: () => void;
  onDropItems: (targetDir: string, items: string[], op: 'copy' | 'move') => void;

  // Presentation
  viewMode: ViewMode;
  density: 'compact' | 'normal' | 'broad';
  colorTags: Record<string, string>;
  isHoverPreviewEnabled?: boolean;
  onContextMenu: (e: React.MouseEvent, item: FsItem | null) => void;
  onHoverStart?: (item: FsItem, rect: DOMRect) => void;
  onHoverEnd?: () => void;
}

export const DualPaneSplitView: React.FC<DualPaneSplitViewProps> = ({
  leftPath,
  leftItems,
  leftLoading,
  leftSelectedPath,
  leftSelectedPaths,
  onSelectLeftItem,
  onOpenLeftItem,
  onNavigateLeft,

  rightPath,
  rightItems,
  rightLoading,
  rightSelectedPath,
  rightSelectedPaths,
  onSelectRightItem,
  onOpenRightItem,
  onNavigateRight,

  activePane,
  onSetActivePane,

  onCopyLeftToRight,
  onMoveLeftToRight,
  onCopyRightToLeft,
  onMoveRightToLeft,
  onMirrorPath,
  onSwapPanes,
  onDropItems,

  viewMode,
  density,
  colorTags,
  isHoverPreviewEnabled = true,
  onContextMenu,
  onHoverStart,
  onHoverEnd
}) => {
  const getParentDir = (p: string) => {
    const lastSlash = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
    return lastSlash > 0 ? p.substring(0, lastSlash) : p;
  };

  return (
    <div className="flex-1 flex overflow-hidden relative select-none">
      {/* ── LEFT PANE ── */}
      <div
        onClick={() => onSetActivePane('left')}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
        }}
        onDrop={e => {
          e.preventDefault();
          try {
            const raw = e.dataTransfer.getData('application/json');
            if (raw && leftPath) {
              const paths: string[] = JSON.parse(raw);
              onDropItems(leftPath, paths, e.altKey ? 'copy' : 'move');
            }
          } catch {}
        }}
        className={`flex-1 flex flex-col min-w-0 border-r border-black/10 dark:border-white/10 transition-all ${
          activePane === 'left'
            ? 'ring-1 ring-[var(--mac-accent)] bg-black/[0.01] dark:bg-white/[0.01]'
            : 'opacity-90'
        }`}
      >
        {/* Left Sub-Header */}
        <div className="h-9 px-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/[0.03] dark:bg-white/[0.03]">
          <div className="flex items-center gap-1.5 truncate max-w-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                activePane === 'left' ? 'bg-[var(--mac-accent)]' : 'bg-transparent border border-neutral-500'
              }`}
            />
            <span className="text-[11px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider">
              Left
            </span>
            <span className="text-xs font-mono font-medium text-[var(--mac-text-primary)] truncate" title={leftPath}>
              {leftPath || 'No Folder'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={e => {
                e.stopPropagation();
                if (leftPath) onNavigateLeft(getParentDir(leftPath));
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-white"
              title="Parent Folder (Left)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[var(--mac-text-muted)] font-mono">
              {leftItems.length} items
            </span>
          </div>
        </div>

        {/* Left Items Grid / Table */}
        <div className="flex-1 overflow-auto p-3">
          {leftLoading ? (
            <div className="flex items-center justify-center h-full text-xs text-neutral-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : viewMode === 'table' ? (
            <ExplorerTable
              items={leftItems}
              selectedPath={leftSelectedPath}
              selectedPaths={leftSelectedPaths}
              colorTags={colorTags}
              isHoverPreviewEnabled={isHoverPreviewEnabled}
              onSelectItem={onSelectLeftItem}
              onOpenItem={onOpenLeftItem}
              onContextMenu={onContextMenu}
              onDropItems={onDropItems}
              onSpringOpenFolder={onNavigateLeft}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          ) : (
            <ExplorerGrid
              items={leftItems}
              selectedPath={leftSelectedPath}
              selectedPaths={leftSelectedPaths}
              colorTags={colorTags}
              density={density}
              isHoverPreviewEnabled={isHoverPreviewEnabled}
              onSelectItem={onSelectLeftItem}
              onOpenItem={onOpenLeftItem}
              onContextMenu={onContextMenu}
              onDropItems={onDropItems}
              onSpringOpenFolder={onNavigateLeft}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          )}
        </div>
      </div>

      {/* ── CENTRAL SPLIT ACTION STRIP (ForkLift / TotalFinder Style) ── */}
      <div className="w-10 bg-neutral-900/90 border-r border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-2 py-4 z-10 flex-shrink-0 shadow-lg">
        {/* Copy Left -> Right */}
        <button
          onClick={onCopyLeftToRight}
          disabled={leftSelectedPaths.size === 0 || !rightPath}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 text-neutral-200 hover:text-white transition-all active:scale-95"
          title={`Copy Left Selected (${leftSelectedPaths.size}) to Right (F5)`}
        >
          <ArrowRight className="w-4 h-4 text-sky-400" />
        </button>

        {/* Copy Right -> Left */}
        <button
          onClick={onCopyRightToLeft}
          disabled={rightSelectedPaths.size === 0 || !leftPath}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 text-neutral-200 hover:text-white transition-all active:scale-95"
          title={`Copy Right Selected (${rightSelectedPaths.size}) to Left (F5)`}
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
        </button>

        <div className="w-6 h-px bg-white/15 my-1" />

        {/* Swap Left & Right Paths */}
        <button
          onClick={onSwapPanes}
          className="p-1.5 rounded-lg hover:bg-white/15 text-neutral-400 hover:text-white transition-colors"
          title="Swap Left and Right Paths"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        {/* Mirror Left Path to Right */}
        <button
          onClick={onMirrorPath}
          className="p-1.5 rounded-lg hover:bg-white/15 text-neutral-400 hover:text-white transition-colors"
          title="Mirror Active Path to Other Pane"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── RIGHT PANE ── */}
      <div
        onClick={() => onSetActivePane('right')}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
        }}
        onDrop={e => {
          e.preventDefault();
          try {
            const raw = e.dataTransfer.getData('application/json');
            if (raw && rightPath) {
              const paths: string[] = JSON.parse(raw);
              onDropItems(rightPath, paths, e.altKey ? 'copy' : 'move');
            }
          } catch {}
        }}
        className={`flex-1 flex flex-col min-w-0 transition-all ${
          activePane === 'right'
            ? 'ring-1 ring-[var(--mac-accent)] bg-black/[0.01] dark:bg-white/[0.01]'
            : 'opacity-90'
        }`}
      >
        {/* Right Sub-Header */}
        <div className="h-9 px-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/[0.03] dark:bg-white/[0.03]">
          <div className="flex items-center gap-1.5 truncate max-w-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                activePane === 'right' ? 'bg-[var(--mac-accent)]' : 'bg-transparent border border-neutral-500'
              }`}
            />
            <span className="text-[11px] font-bold text-[var(--mac-text-muted)] uppercase tracking-wider">
              Right
            </span>
            <span className="text-xs font-mono font-medium text-[var(--mac-text-primary)] truncate" title={rightPath}>
              {rightPath || 'Select Folder'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={e => {
                e.stopPropagation();
                if (rightPath) onNavigateRight(getParentDir(rightPath));
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-white"
              title="Parent Folder (Right)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[var(--mac-text-muted)] font-mono">
              {rightItems.length} items
            </span>
          </div>
        </div>

        {/* Right Items Grid / Table */}
        <div className="flex-1 overflow-auto p-3">
          {rightLoading ? (
            <div className="flex items-center justify-center h-full text-xs text-neutral-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : viewMode === 'table' ? (
            <ExplorerTable
              items={rightItems}
              selectedPath={rightSelectedPath}
              selectedPaths={rightSelectedPaths}
              colorTags={colorTags}
              isHoverPreviewEnabled={isHoverPreviewEnabled}
              onSelectItem={onSelectRightItem}
              onOpenItem={onOpenRightItem}
              onContextMenu={onContextMenu}
              onDropItems={onDropItems}
              onSpringOpenFolder={onNavigateRight}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          ) : (
            <ExplorerGrid
              items={rightItems}
              selectedPath={rightSelectedPath}
              selectedPaths={rightSelectedPaths}
              colorTags={colorTags}
              density={density}
              isHoverPreviewEnabled={isHoverPreviewEnabled}
              onSelectItem={onSelectRightItem}
              onOpenItem={onOpenRightItem}
              onContextMenu={onContextMenu}
              onDropItems={onDropItems}
              onSpringOpenFolder={onNavigateRight}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          )}
        </div>
      </div>
    </div>
  );
};
