import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Image as ImageIcon,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { FsItem } from '../../types';
import {
  isPhotoExtension,
  isVideoExtension,
  isRawExtension,
  formatBytes,
  formatDate,
  formatTimelapse
} from '../../utils';
import { thumbnailService } from '../../services';
import { MacFolderIcon, MacDocumentIcon } from '../common/MacIcons';
import { classifyFolder } from '../../utils/afmTaxonomy';

interface ExplorerTableProps {
  items: FsItem[];
  selectedPath: string | null;
  selectedPaths?: Set<string>;
  cutPaths?: Set<string>;
  renamingPath?: string | null;
  colorTags?: Record<string, string>;
  onSelectItem: (item: FsItem, e?: React.MouseEvent) => void;
  onOpenItem: (item: FsItem) => void;
  onQuickLook?: (item: FsItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: FsItem | null) => void;
  onCommitRename?: (item: FsItem, newName: string) => void;
  onCancelRename?: () => void;
}

function getItemKind(item: FsItem): string {
  if (item.isDir) return 'Folder';
  const ext = item.ext.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG image';
  if (ext === 'png') return 'PNG image';
  if (ext === 'gif') return 'GIF image';
  if (ext === 'webp') return 'WebP image';
  if (ext === 'svg') return 'SVG image';
  if (ext === 'mp4') return 'MP4 video';
  if (ext === 'mov') return 'QuickTime movie';
  if (ext === 'avi') return 'AVI video';
  if (ext === 'mkv') return 'Matroska video';
  if (ext === 'pdf') return 'PDF document';
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'Archive';
  if (ext === 'exe' || ext === 'msi') return 'Application';
  if (ext === 'txt') return 'Plain text document';
  if (ext === 'md') return 'Markdown document';
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx' || ext === 'json') return 'Source code';
  return ext ? `${ext.toUpperCase()} document` : 'Document';
}

function VideoDurationBadge({ item }: { item: FsItem }) {
  const cached = thumbnailService.getCached(item.fullPath);
  const [duration, setDuration] = useState<number>(cached?.duration || 0);

  useEffect(() => {
    if (!isVideoExtension(item.ext)) return;
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
  }, [item.fullPath, item.ext]);

  if (duration <= 0) return null;

  return (
    <span className="text-[11px] text-[var(--mac-text-muted)] font-mono ml-1.5 opacity-80">
      ({formatTimelapse(duration)})
    </span>
  );
}

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  items,
  selectedPath,
  selectedPaths,
  cutPaths,
  renamingPath,
  colorTags = {},
  onSelectItem,
  onOpenItem,
  onQuickLook,
  onContextMenu,
  onCommitRename,
  onCancelRename
}) => {
  const [tableRenameVal, setTableRenameVal] = useState('');
  const tableRenameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingPath) {
      const target = items.find(i => i.fullPath === renamingPath);
      if (target) {
        setTableRenameVal(target.name);
        setTimeout(() => {
          if (tableRenameRef.current) {
            tableRenameRef.current.focus();
            const dotIdx = target.name.lastIndexOf('.');
            if (!target.isDir && dotIdx > 0) {
              tableRenameRef.current.setSelectionRange(0, dotIdx);
            } else {
              tableRenameRef.current.select();
            }
          }
        }, 50);
      }
    }
  }, [renamingPath, items]);

  // Authentic macOS Finder List View Column Widths
  const [colWidths, setColWidths] = useState({
    name: 420,
    date: 190,
    size: 130,
    kind: 180
  });

  const resizingCol = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const startColResize = (colKey: keyof typeof colWidths, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colKey;
    startX.current = e.clientX;
    startWidth.current = colWidths[colKey];

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = ev.clientX - startX.current;
      const key = resizingCol.current as keyof typeof colWidths;
      const minW = key === 'name' ? 200 : 90;
      const newWidth = Math.max(minW, startWidth.current + delta);
      setColWidths(prev => ({ ...prev, [key]: newWidth }));
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onContextMenu={e => onContextMenu?.(e, null)}
      className="w-full h-full overflow-auto select-none mac-content transition-colors duration-200"
    >
      <table className="w-full text-sm border-collapse table-fixed">
        <thead className="sticky top-0 z-10 backdrop-blur-md">
          <tr className="text-xs text-[var(--mac-text-muted)] border-b border-[var(--mac-border)] mac-header select-none">
            {/* 1. Name Column */}
            <th
              style={{ width: `${colWidths.name}px` }}
              className="relative text-left py-2 px-3 font-medium cursor-default"
            >
              <span>Name</span>
              <div
                onMouseDown={e => startColResize('name', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-[#007AFF] transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* 2. Date Modified Column */}
            <th
              style={{ width: `${colWidths.date}px` }}
              className="relative text-left py-2 px-3 font-medium cursor-default"
            >
              <span>Date Modified</span>
              <div
                onMouseDown={e => startColResize('date', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-[#007AFF] transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* 3. Size Column */}
            <th
              style={{ width: `${colWidths.size}px` }}
              className="relative text-right py-2 px-3 font-medium cursor-default"
            >
              <span>Size</span>
              <div
                onMouseDown={e => startColResize('size', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-[#007AFF] transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* 4. Kind Column */}
            <th
              style={{ width: `${colWidths.kind}px` }}
              className="relative text-left py-2 px-3 font-medium cursor-default"
            >
              <span>Kind</span>
              <div
                onMouseDown={e => startColResize('kind', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-[#007AFF] transition-colors"
                title="Drag to resize column"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const isSelected = selectedPaths ? selectedPaths.has(item.fullPath) : selectedPath === item.fullPath;
            const isCut = cutPaths ? cutPaths.has(item.fullPath) : false;
            const isRenaming = renamingPath === item.fullPath;
            const tag = colorTags[item.fullPath] || null;
            const isRaw = isRawExtension(item.ext);
            const isPhoto = isPhotoExtension(item.ext);
            const isVideo = isVideoExtension(item.ext);

            return (
              <tr
                key={item.fullPath}
                onClick={e => onSelectItem(item, e)}
                onDoubleClick={() => onOpenItem(item)}
                onContextMenu={e => {
                  e.stopPropagation();
                  onSelectItem(item, e);
                  onContextMenu?.(e, item);
                }}
                className={`group cursor-pointer transition-colors border-b border-[var(--mac-border-subtle)] text-xs ${
                  isSelected
                    ? 'bg-[#007AFF] text-white font-medium shadow-xs'
                    : 'hover:bg-black/5 dark:hover:bg-white/[0.04] text-[var(--mac-text-primary)]'
                } ${item.isHidden && !isSelected ? 'opacity-50 hover:opacity-100' : ''} ${
                  isCut ? 'opacity-40 filter grayscale-[40%]' : ''
                }`}
              >
                {/* 1. Name */}
                <td className="py-1.5 px-3 truncate">
                  <div className="flex items-center gap-2 truncate">
                    {/* Color Tag Dot */}
                    {tag && (
                      <span
                        style={{ backgroundColor: tag }}
                        className="w-2.5 h-2.5 rounded-full shadow-xs ring-1 ring-white/30 flex-shrink-0"
                        title={`Tag: ${tag}`}
                      />
                    )}

                    {/* Icon */}
                    {item.isDir ? (
                      <MacFolderIcon size={18} className="flex-shrink-0" />
                    ) : isRaw ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <ImageIcon className="w-4 h-4 text-rose-400" />
                        <span className="text-[8.5px] font-bold px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                          RAW
                        </span>
                      </div>
                    ) : isPhoto ? (
                      <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : isVideo ? (
                      <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    ) : (
                      <MacDocumentIcon size={18} ext={item.ext} className="flex-shrink-0" />
                    )}

                    {/* Inline Rename or Name */}
                    {isRenaming ? (
                      <input
                        ref={tableRenameRef}
                        type="text"
                        value={tableRenameVal}
                        onChange={e => setTableRenameVal(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onDoubleClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onCommitRename?.(item, tableRenameVal);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            onCancelRename?.();
                          }
                        }}
                        onBlur={() => onCommitRename?.(item, tableRenameVal)}
                        className="w-full text-xs bg-white dark:bg-[#1a1c29] text-neutral-900 dark:text-white border-2 border-[#007AFF] rounded px-1.5 py-0.5 outline-none shadow font-medium"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate" title={item.name}>
                          {item.name}
                        </span>
                        {item.isDir && (() => {
                          const afm = classifyFolder(item.name, item.fullPath);
                          if (afm.type === 'slot_item_a' || afm.type === 'slot_item_b') {
                            return (
                              <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-[8.5px] uppercase tracking-wider flex-shrink-0">
                                SLOT {afm.slotTokens?.slotNo || ''}
                              </span>
                            );
                          }
                          if (afm.type === 'date_session') {
                            return (
                              <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold text-[8.5px] uppercase tracking-wider flex-shrink-0">
                                SESSION
                              </span>
                            );
                          }
                          if (afm.type === 'master_safar') {
                            return (
                              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[8.5px] uppercase tracking-wider flex-shrink-0">
                                SAFAR
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Subtle Quick Look Eye icon on hover */}
                    {onQuickLook && !isRenaming && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onQuickLook(item);
                        }}
                        className={`ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ${
                          isSelected ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-[var(--mac-text-primary)]'
                        }`}
                        title="Quick Look (Space)"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>

                {/* 2. Date Modified */}
                <td
                  className={`py-1.5 px-3 truncate ${
                    isSelected ? 'text-white/90' : 'text-[var(--mac-text-secondary)]'
                  }`}
                >
                  {formatDate(item.mtime)}
                </td>

                {/* 3. Size (Folders: X items; Files: formatted size) */}
                <td
                  className={`py-1.5 px-3 text-right tabular-nums truncate ${
                    isSelected ? 'text-white/90' : 'text-[var(--mac-text-secondary)]'
                  }`}
                >
                  {item.isDir
                    ? (item.childCount !== undefined
                        ? `${item.childCount} ${item.childCount === 1 ? 'item' : 'items'}`
                        : '—')
                    : formatBytes(item.size)}
                </td>

                {/* 4. Kind */}
                <td
                  className={`py-1.5 px-3 truncate ${
                    isSelected ? 'text-white/90' : 'text-[var(--mac-text-secondary)]'
                  }`}
                >
                  <span>{getItemKind(item)}</span>
                  {isVideo && <VideoDurationBadge item={item} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
