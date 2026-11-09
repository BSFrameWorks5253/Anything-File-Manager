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
  EyeOff,
  CopyPlus,
  Check
} from 'lucide-react';
import { FsItem } from '../../types';
import { isVideoExtension } from '../../utils';
import { oneTapService } from '../../services';

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
  onOpenProperties?: (item: FsItem | null) => void;
  onRefresh?: () => void;
  onNewFolder?: () => void;
  onToggleHidden?: () => void;
  showHidden?: boolean;
  currentFolderItem?: FsItem | null;
  // CRUD Actions
  onCut?: (item: FsItem) => void;
  onCopy?: (item: FsItem) => void;
  onPaste?: () => void;
  onDuplicate?: (item: FsItem) => void;
  onRename?: (item: FsItem) => void;
  onDelete?: (item: FsItem, permanent?: boolean) => void;
  onSetColorTag?: (filePath: string, color: string | null) => void;
  currentColorTag?: string | null;
  canPaste?: boolean;
  onOpenSequenceMaker?: (item: FsItem) => void;
}

const MAC_TAGS = [
  { name: 'Red', color: '#EF4444' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Green', color: '#10B981' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Gray', color: '#6B7280' }
];

export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({
  menu,
  onClose,
  onOpen,
  onOpenSeparately,
  onQuickLook,
  onShowInExplorer,
  onCopyPath,
  onInspect,
  onOpenProperties,
  onRefresh,
  onNewFolder,
  onToggleHidden,
  showHidden,
  currentFolderItem,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onRename,
  onDelete,
  onSetColorTag,
  currentColorTag,
  canPaste = false,
  onOpenSequenceMaker
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
  const menuWidth = 250;
  const menuHeight = menu.item ? 460 : 250;
  const adjustedX = Math.min(menu.x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(menu.y, window.innerHeight - menuHeight - 10);

  const { item } = menu;

  return (
    <div
      ref={menuRef}
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`
      }}
      className="fixed z-50 w-64 rounded-xl bg-white/95 dark:bg-[#1a1d2c]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl py-1.5 text-xs text-neutral-800 dark:text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-100"
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

          {item.isDir && (
            <>

              {onOpenSequenceMaker && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSequenceMaker(item);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-purple-400 group-hover:text-white" />
                    <span className="font-semibold text-purple-600 dark:text-purple-300 group-hover:text-white">Create Premiere Pro Project (F8)...</span>
                  </div>
                </button>
              )}
              <button
                onClick={() => {
                  onInspect(item);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-purple-400 group-hover:text-white" />
                  <span>Inspect Production Session</span>
                </div>
              </button>

              <button
                onClick={async () => {
                  onClose();
                  await oneTapService.separatePhotosAndVideos(item.fullPath);
                  if (onRefresh) onRefresh();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:text-white" />
                  <span>Separate Photos & Videos (PV)</span>
                </div>
              </button>
            </>
          )}

          {/* ── macOS Color Dot Tags ── */}
          <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
          <div className="px-3 py-1.5">
            <div className="text-[10px] font-semibold text-[var(--mac-text-muted)] mb-1.5 uppercase tracking-wider">
              Tags
            </div>
            <div className="flex items-center justify-between gap-1">
              {MAC_TAGS.map(tag => {
                const isSelected = currentColorTag?.toLowerCase() === tag.color.toLowerCase();
                return (
                  <button
                    key={tag.name}
                    onClick={() => {
                      onSetColorTag?.(item.fullPath, isSelected ? null : tag.color);
                      onClose();
                    }}
                    style={{ backgroundColor: tag.color }}
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-transform hover:scale-125 shadow-sm ${
                      isSelected ? 'ring-2 ring-offset-2 ring-white dark:ring-black scale-110' : ''
                    }`}
                    title={tag.name}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                );
              })}
              {currentColorTag && (
                <button
                  onClick={() => {
                    onSetColorTag?.(item.fullPath, null);
                    onClose();
                  }}
                  className="text-[10px] text-gray-400 hover:text-red-400 ml-1 px-1 rounded"
                  title="Remove Tag"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Cut / Copy / Duplicate / Rename ── */}
          <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

          {onCut && (
            <button
              onClick={() => {
                onCut(item);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-blue-400 group-hover:text-white" />
                <span>Cut</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+X</span>
            </button>
          )}

          {onCopy && (
            <button
              onClick={() => {
                onCopy(item);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
                <span>Copy</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+C</span>
            </button>
          )}

          {onDuplicate && (
            <button
              onClick={() => {
                onDuplicate(item);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <CopyPlus className="w-3.5 h-3.5 text-amber-500 group-hover:text-white" />
                <span>Duplicate</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+D</span>
            </button>
          )}

          {onRename && (
            <button
              onClick={() => {
                onRename(item);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Edit2 className="w-3.5 h-3.5 text-purple-400 group-hover:text-white" />
                <span>Rename</span>
              </div>
              <span className="text-[10px] opacity-60">F2</span>
            </button>
          )}

          {/* ── Recycle Bin / Permanent Delete ── */}
          <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

          {onDelete && (
            <>
              <button
                onClick={() => {
                  onDelete(item, false);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-500 hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:text-white" />
                  <span>Move to Trash</span>
                </div>
                <span className="text-[10px] opacity-60">Delete</span>
              </button>

              <button
                onClick={() => {
                  onDelete(item, true);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-600 hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5 text-red-500 group-hover:text-white" />
                  <span>Permanent Delete</span>
                </div>
                <span className="text-[10px] opacity-60">Shift+Delete</span>
              </button>
            </>
          )}

          {/* ── Properties & Utility ── */}
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
              if (onOpenProperties) {
                onOpenProperties(item);
              } else {
                onInspect(item);
              }
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
              <span className="font-semibold">Properties</span>
            </div>
            <span className="text-[10px] opacity-60">Alt+Enter</span>
          </button>

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

          {currentFolderItem && onOpenSequenceMaker && (
            <button
              onClick={() => {
                onClose();
                onOpenSequenceMaker(currentFolderItem);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Film className="w-3.5 h-3.5 text-purple-400 group-hover:text-white" />
                <span className="font-semibold text-purple-600 dark:text-purple-300 group-hover:text-white">Create Premiere Pro Project (F8)...</span>
              </div>
            </button>
          )}
          {onNewFolder && (
            <button
              onClick={() => {
                onNewFolder();
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <FolderPlus className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white" />
                <span className="font-semibold">New Folder</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+Shift+N</span>
            </button>
          )}

          {onPaste && (
            <button
              onClick={() => {
                if (canPaste) {
                  onPaste();
                  onClose();
                }
              }}
              disabled={!canPaste}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white disabled:opacity-35 disabled:hover:bg-transparent transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5 text-teal-400 group-hover:text-white" />
                <span>Paste</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+V</span>
            </button>
          )}

          <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

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

          {currentFolderItem && (
            <>
              <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />

              <button
                onClick={() => {
                  onShowInExplorer(currentFolderItem.fullPath);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-amber-500 group-hover:text-white" />
                  <span>Show Folder in Explorer</span>
                </div>
              </button>

              <button
                onClick={() => {
                  if (onOpenProperties) {
                    onOpenProperties(currentFolderItem);
                  }
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
                  <span className="font-semibold">Folder Properties</span>
                </div>
                <span className="text-[10px] opacity-60">Alt+Enter</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};
