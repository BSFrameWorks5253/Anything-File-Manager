import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  ChevronRight,
  Film,
  Image as ImageIcon,
  File,
  Clock,
  Maximize2,
  Eye,
  X
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  isRawExtension,
  formatBytes,
  formatTimelapse
} from '../../utils';
import { mediaService, thumbnailService } from '../../services';
import { MacFolderIcon, MacDocumentIcon } from '../common/MacIcons';

interface ColumnLevel {
  path: string;
  items: FsItem[];
  selectedItem: FsItem | null;
}

interface ExplorerColumnsProps {
  currentPath: string;
  initialItems: FsItem[];
  isInspectorOpen?: boolean;
  colorTags?: Record<string, string>;
  selectedTagColor?: string | null;
  onSelectItem: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
  onQuickLook?: (item: FsItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: FsItem | null) => void;
}

function ColumnVideoDuration({ item, isSelected }: { item: FsItem; isSelected: boolean }) {
  const isVid = isVideoExtension(item.ext);
  const cached = thumbnailService.getCached(item.fullPath);
  const [duration, setDuration] = useState<number>(cached?.duration || 0);

  useEffect(() => {
    if (!isVid) return;
    const c = thumbnailService.getCached(item.fullPath);
    if (c && c.duration > 0) {
      setDuration(c.duration);
      return;
    }
    let isCurrent = true;
    thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
      if (isCurrent && res && res.duration > 0) {
        setDuration(res.duration);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [item.fullPath, isVid]);

  if (!isVid || duration <= 0) return null;

  return (
    <span
      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0 ${
        isSelected
          ? 'bg-black/40 text-amber-300 border border-amber-400/40'
          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
      }`}
      title={`Duration: ${formatTimelapse(duration)}`}
    >
      <Clock className="w-2.5 h-2.5 text-amber-400" />
      {formatTimelapse(duration)}
    </span>
  );
}

export const ExplorerColumns: React.FC<ExplorerColumnsProps> = ({
  currentPath,
  initialItems,
  isInspectorOpen = false,
  colorTags = {},
  selectedTagColor = null,
  onSelectItem,
  onOpenItem,
  onQuickLook,
  onContextMenu
}) => {
  const [columns, setColumns] = useState<ColumnLevel[]>([]);
  const [previewItem, setPreviewItem] = useState<FsItem | null>(null);
  const [previewThumb, setPreviewThumb] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number>(0);

  // Per-column resizable widths (default: 340px for comfortable reading of camera filenames)
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const resizingCol = useRef<number | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Initialize first column
  useEffect(() => {
    setColumns([
      {
        path: currentPath,
        items: initialItems,
        selectedItem: null
      }
    ]);
    setPreviewItem(null);
  }, [currentPath, initialItems]);

    const filterByTag = (itemList: FsItem[]) => {
    if (!selectedTagColor) return itemList;
    const target = selectedTagColor.toLowerCase();
    const normalize = (p: string) => p.replace(/[\/\\]+/g, '\\').toLowerCase().replace(/\\$/, '');
    const taggedPaths = new Set(
      Object.entries(colorTags || {})
        .filter(([_, c]) => c && c.toLowerCase() === target)
        .map(([p]) => normalize(p))
    );
    return itemList.filter(i => taggedPaths.has(normalize(i.fullPath)));
  };

  const handleColumnClick = async (columnIndex: number, item: FsItem) => {
    onSelectItem(item);

    // Truncate subsequent columns
    const nextCols = columns.slice(0, columnIndex + 1);
    nextCols[columnIndex].selectedItem = item;

    if (item.isDir) {
      setPreviewItem(null);
      const subItems = await mediaService.listDir(item.fullPath);
      nextCols.push({
        path: item.fullPath,
        items: filterByTag(subItems),
        selectedItem: null
      });
      setColumns(nextCols);
    } else {
      setColumns(nextCols);
      setPreviewItem(item);
      setPreviewThumb(null);

      const isVid = isVideoExtension(item.ext);
      const isRaw = isRawExtension(item.ext);

      if (isVid || isRaw) {
        const cached = thumbnailService.getCached(item.fullPath);
        if (cached && cached.thumb) {
          setPreviewThumb(cached.thumb);
          setPreviewDuration(cached.duration);
        } else {
          thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
            if (res && res.thumb) {
              setPreviewThumb(res.thumb);
              setPreviewDuration(res.duration);
            }
          });
          if (isRaw) {
            mediaService.readImageBase64(item.fullPath).then(res => {
              if (res.ok && res.dataUrl) {
                setPreviewThumb(res.dataUrl);
              }
            });
          }
        }
      }
    }
  };

  // Draggable column resizing logic
  const startResize = (colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colIdx;
    startX.current = e.clientX;
    startWidth.current = columnWidths[colIdx] || 340;

    const onMouseMove = (ev: MouseEvent) => {
      if (resizingCol.current === null) return;
      const delta = ev.clientX - startX.current;
      const newWidth = Math.max(220, Math.min(800, startWidth.current + delta));
      setColumnWidths(prev => ({ ...prev, [colIdx]: newWidth }));
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDoubleDividerClick = (colIdx: number) => {
    // Toggle between default 340px and wide 480px on double-click
    setColumnWidths(prev => ({
      ...prev,
      [colIdx]: (prev[colIdx] || 340) > 360 ? 300 : 480
    }));
  };

  return (
    <div className="flex h-full overflow-x-auto no-scrollbar mac-content select-none transition-colors duration-200">
      {columns.map((col, colIdx) => {
        const width = columnWidths[colIdx] || 340;

        return (
          <div
            key={col.path + colIdx}
            style={{ width: `${width}px`, minWidth: `${width}px` }}
            className="relative border-r border-[var(--mac-border)] flex flex-col h-full bg-[var(--mac-bg-content)] flex-shrink-0 transition-colors duration-200"
          >
            {/* Column Header */}
            <div className="px-3 py-2 border-b border-[var(--mac-border)] mac-header text-[11px] font-semibold text-[var(--mac-text-secondary)] truncate flex items-center justify-between">
              <span className="truncate" title={col.path}>
                {col.path.split(/[\\/]/).filter(Boolean).pop() || col.path}
              </span>
              <span className="text-[10px] text-[var(--mac-text-muted)] font-mono ml-2 flex-shrink-0">
                {col.items.length} items
              </span>
            </div>

            {/* Column Items List */}
            <div
              onContextMenu={e => onContextMenu?.(e, null)}
              className="flex-1 overflow-y-auto p-1 space-y-0.5"
            >
              {col.items.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--mac-text-muted)]">Empty folder</div>
              ) : (
                col.items.map(item => {
                  const isSelected = col.selectedItem?.fullPath === item.fullPath;
                  const isRaw = isRawExtension(item.ext);
                  const isPhoto = isPhotoExtension(item.ext);
                  const isVideo = isVideoExtension(item.ext);

                  return (
                    <div
                      key={item.fullPath}
                      onClick={() => handleColumnClick(colIdx, item)}
                      onDoubleClick={() => onOpenItem(item)}
                      onContextMenu={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleColumnClick(colIdx, item);
                        onContextMenu?.(e, item);
                      }}
                      className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--mac-accent)] text-white font-medium shadow-sm'
                          : 'text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-1.5">
                        {item.isDir ? (
                          <MacFolderIcon size={16} className="flex-shrink-0" />
                        ) : isRaw ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <ImageIcon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-rose-400'}`} />
                            <span className="text-[9px] font-bold px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                              RAW
                            </span>
                          </div>
                        ) : isPhoto ? (
                          <ImageIcon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />
                        ) : isVideo ? (
                          <Film className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-purple-400'}`} />
                        ) : (
                          <MacDocumentIcon size={16} ext={item.ext} className="flex-shrink-0" />
                        )}
                        <span className="truncate" title={item.name}>
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Video Duration / Timelapse */}
                        {isVideo && (
                          <ColumnVideoDuration item={item} isSelected={isSelected} />
                        )}

                        {item.isDir ? (
                          <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                        ) : (
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>
                            {formatBytes(item.size)}
                          </span>
                        )}

                        {/* Quick Look button on hover */}
                        {!item.isDir && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleColumnClick(colIdx, item);
                              onQuickLook?.(item);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded text-gray-300 hover:text-white transition-opacity ml-1"
                            title="Quick Look (Space)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Draggable Resize Divider on the Right Border */}
            <div
              onMouseDown={e => startResize(colIdx, e)}
              onDoubleClick={() => handleDoubleDividerClick(colIdx)}
              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/70 active:bg-indigo-500 z-20 transition-colors"
              title="Drag to resize column (Double-click to toggle width)"
            />
          </div>
        );
      })}

      {/* ── macOS Finder Style Preview Column (When file selected and right Inspector is not already open) ── */}
      {previewItem && !isInspectorOpen && (
        <div className="w-80 min-w-[300px] border-r border-[var(--mac-border)] flex flex-col h-full mac-sidebar p-4 select-none flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--mac-text-muted)] uppercase tracking-wider">Preview</span>
            <button
              onClick={() => setPreviewItem(null)}
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] transition-colors"
              title="Close Preview Column"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="aspect-video w-full bg-black/10 dark:bg-black/60 rounded-xl overflow-hidden flex items-center justify-center relative shadow-sm border border-[var(--mac-border)] mb-4">
            {isRawExtension(previewItem.ext) ? (
              previewThumb ? (
                <img
                  src={previewThumb}
                  alt={previewItem.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-rose-500 dark:text-rose-400">
                  <ImageIcon className="w-12 h-12 opacity-60 animate-pulse" />
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-300 mt-1 uppercase">RAW Preview</span>
                </div>
              )
            ) : isPhotoExtension(previewItem.ext) ? (
              <img
                src={previewThumb || mediaService.toLocalResourceUrl(previewItem.fullPath)}
                alt={previewItem.name}
                onError={(e) => {
                  mediaService.readImageBase64(previewItem.fullPath).then(res => {
                    if (res.ok && res.dataUrl) {
                      (e.target as HTMLImageElement).src = res.dataUrl;
                    }
                  });
                }}
                className="w-full h-full object-contain"
              />
            ) : isVideoExtension(previewItem.ext) ? (
              previewThumb ? (
                <img
                  src={previewThumb}
                  alt={previewItem.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Film className="w-12 h-12 text-indigo-500 dark:text-indigo-400 opacity-60 animate-pulse" />
              )
            ) : previewItem.isDir ? (
              <MacFolderIcon size={80} />
            ) : (
              <MacDocumentIcon size={76} ext={previewItem.ext} />
            )}

            {isVideoExtension(previewItem.ext) && previewDuration > 0 && (
              <span className="absolute bottom-2 right-2 bg-black/85 text-amber-300 border border-amber-400/40 text-[11px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatTimelapse(previewDuration)}
              </span>
            )}
          </div>

          <span className="text-sm font-semibold text-[var(--mac-text-primary)] truncate break-words mb-1">
            {previewItem.name}
          </span>
          <div className="flex items-center gap-2 text-xs text-[var(--mac-text-secondary)] mb-4">
            <span className="font-mono">{formatBytes(previewItem.size)}</span>
            <span>•</span>
            <span className="uppercase text-indigo-600 dark:text-indigo-400 font-semibold">{previewItem.ext}</span>
          </div>

          {/* Quick Look & Fullscreen action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onQuickLook?.(previewItem)}
              className="w-full py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--mac-text-primary)] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-[var(--mac-border)]"
            >
              <Eye className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span>Quick Look Preview (Space)</span>
            </button>

            <button
              onClick={() => onOpenItem(previewItem)}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Open Studio Viewer & Zoom</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
