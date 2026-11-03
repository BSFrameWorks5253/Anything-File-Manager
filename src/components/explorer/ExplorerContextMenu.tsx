import React, { useEffect, useRef } from 'react';
import {
  FolderOpen,
  Eye,
  Maximize2,
  Copy,
  Scissors,
  Clipboard,
  Edit2,
  Trash2,
  ExternalLink,
  Film,
  Sparkles,
  Info,
  RefreshCw,
  FolderPlus,
  EyeOff
} from 'lucide-react';
import { FsItem } from '../../types';
import { isVideoExtension } from '../../utils';

export interface ContextMenuState {
  x: number;
  y: number;
  item: FsItem | null;
  isOpen: boolean;
}

interface ExplorerContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onOpen: (item: FsItem) => void;
  onOpenSeparately: (item: FsItem) => void;
  onQuickLook: (item: FsItem) => void;
  onShowInExplorer: (fullPath: string) => void;
  onCopyPath: (fullPath: string) => void;
  onInspect: (item: FsItem) => void;
  onRefresh?: () => void;
  onNewFolder?: () => void;
  onToggleHidden?: () => void;
  showHidden?: boolean;
}

export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({
  menu,
  onClose,
  onOpen,
  onOpenSeparately,
  onQuickLook,
  onShowInExplorer,
  onCopyPath,
  onInspect,
  onRefresh,
  onNewFolder,
  onToggleHidden,
  showHidden
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!menu.isOpen) return null;

  // Adjust menu coordinates so it doesn't overflow screen boundaries
  const menuWidth = 240;
  const menuHeight = menu.item ? 360 : 220;
  const adjustedX = Math.min(menu.x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(menu.y, window.innerHeight - menuHeight - 10);

  const { item } = menu;
  const isVideo = item ? isVideoExtension(item.ext) : false;

  return (
    <div
      ref={menuRef}
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`
      }}
      className="fixed z-50 w-60 rounded-xl bg-white/95 dark:bg-[#1c1f2b]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl py-1.5 text-xs text-neutral-800 dark:text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {item ? (
        /* ── Item Context Menu (File or Folder) ── */
        <>
          <button
            onClick={() => {
              onOpen(item);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500 group-hover:text-white" />
              <span className="font-semibold">{item.isDir ? 'Open Folder' : 'Open'}</span>
            </div>
            <span className="text-[10px] opacity-60">Enter</span>
          </button>

          {!item.isDir && (
            <button
              onClick={() => {
                onOpenSeparately(item);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white" />
                <span>Open in Separate Player</span>
              </div>
            </button>
          )}

          {!item.isDir && (
            <button
              onClick={() => {
                onQuickLook(item);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-sky-500 group-hover:text-white" />
                <span>Quick Look</span>
              </div>
              <span className="text-[10px] opacity-60">Space</span>
            </button>
          )}

          <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

          <button
            onClick={() => {
              onCopyPath(item.fullPath);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
              <span>Copy Path</span>
            </div>
            <span className="text-[10px] opacity-60">Ctrl+Shift+C</span>
          </button>

          <button
            onClick={() => {
              onInspect(item);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
              <span>Inspect & Metadata</span>
            </div>
            <span className="text-[10px] opacity-60">Alt+Enter</span>
          </button>

          <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

          <button
            onClick={() => {
              onShowInExplorer(item.fullPath);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-amber-500 group-hover:text-white" />
              <span>Show in Windows Explorer</span>
            </div>
          </button>
        </>
      ) : (
        /* ── Canvas / Background Context Menu ── */
        <>
          {onRefresh && (
            <button
              onClick={() => {
                onRefresh();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-sky-500 group-hover:text-white" />
                <span>Refresh</span>
              </div>
              <span className="text-[10px] opacity-60">F5</span>
            </button>
          )}

          {onToggleHidden && (
            <button
              onClick={() => {
                onToggleHidden();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
                <span>{showHidden ? 'Hide Hidden Items' : 'Show Hidden Items'}</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+Shift+.</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
