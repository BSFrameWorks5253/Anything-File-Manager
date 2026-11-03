import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  Film,
  Image as ImageIcon,
  Clock,
  Eye,
  Maximize2
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

interface ExplorerTableProps {
  items: FsItem[];
  selectedPath: string | null;
  onSelectItem: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
  onQuickLook?: (item: FsItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: FsItem | null) => void;
}

function TableVideoDuration({ item }: { item: FsItem }) {
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

  if (!isVid) return <span className="text-gray-600">—</span>;

  if (duration > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
        <Clock className="w-3 h-3 text-amber-400" />
        {formatTimelapse(duration)}
      </span>
    );
  }

  return <span className="text-[11px] text-gray-500 font-mono">...</span>;
}

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  items,
  selectedPath,
  onSelectItem,
  onOpenItem,
  onQuickLook,
  onContextMenu
}) => {
  // Resizable table columns widths (in pixels)
  const [colWidths, setColWidths] = useState({
    name: 420,
    type: 90,
    duration: 120,
    size: 110,
    date: 180,
    actions: 70
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
      const minW = key === 'name' ? 180 : key === 'actions' ? 50 : 70;
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
      className="w-full overflow-x-auto select-none mac-content transition-colors duration-200"
    >
      <table className="w-full text-sm border-collapse table-fixed">
        <thead>
          <tr className="text-[11px] text-[var(--mac-text-muted)] uppercase border-b border-[var(--mac-border)] mac-header">
            {/* Name Column */}
            <th
              style={{ width: `${colWidths.name}px` }}
              className="relative text-left py-2.5 px-3 font-semibold"
            >
              <span>Name</span>
              <div
                onMouseDown={e => startColResize('name', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* Type Column */}
            <th
              style={{ width: `${colWidths.type}px` }}
              className="relative text-left py-2.5 px-3 font-semibold"
            >
              <span>Type</span>
              <div
                onMouseDown={e => startColResize('type', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* Duration / Timelapse Column */}
            <th
              style={{ width: `${colWidths.duration}px` }}
              className="relative text-left py-2.5 px-3 font-semibold"
            >
              <div className="flex items-center gap-1 text-amber-300">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Timelapse</span>
              </div>
              <div
                onMouseDown={e => startColResize('duration', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* Size Column */}
            <th
              style={{ width: `${colWidths.size}px` }}
              className="relative text-right py-2.5 px-3 font-semibold"
            >
              <span>Size</span>
              <div
                onMouseDown={e => startColResize('size', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* Date Modified Column */}
            <th
              style={{ width: `${colWidths.date}px` }}
              className="relative text-right py-2.5 px-3 font-semibold"
            >
              <span>Date Modified</span>
              <div
                onMouseDown={e => startColResize('date', e)}
                className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/80 active:bg-indigo-500 transition-colors"
                title="Drag to resize column"
              />
            </th>

            {/* Quick Actions Column */}
            <th
              style={{ width: `${colWidths.actions}px` }}
              className="text-center py-2.5 px-2 font-semibold"
            >
              <span>Preview</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const isSelected = selectedPath === item.fullPath;
            const isRaw = isRawExtension(item.ext);
            const isPhoto = isPhotoExtension(item.ext);
            const isVideo = isVideoExtension(item.ext);

            return (
              <tr
                key={item.fullPath}
                onClick={() => onSelectItem(item)}
                onDoubleClick={() => onOpenItem(item)}
                onContextMenu={e => {
                  e.stopPropagation();
                  onSelectItem(item);
                  onContextMenu?.(e, item);
                }}
                className={`group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-[var(--mac-border-subtle)] ${
                  isSelected ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-[var(--mac-text-primary)]'
                } ${item.isHidden && !isSelected ? 'opacity-55 hover:opacity-100' : ''}`}
              >
                {/* Name */}
                <td className="py-2 px-3 truncate">
                  <div className="flex items-center gap-2.5 truncate">
                    {item.isDir ? (
                      <MacFolderIcon size={18} className="flex-shrink-0" />
                    ) : isRaw ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <ImageIcon className="w-4 h-4 text-rose-400" />
                        <span className="text-[9px] font-bold px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
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
                    <span className="truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                </td>

                {/* Type */}
                <td className="py-2 px-3 text-xs uppercase text-gray-400 truncate">
                  {item.isDir ? 'Folder' : item.ext}
                </td>

                {/* Video Duration / Timelapse */}
                <td className="py-2 px-3 text-xs">
                  <TableVideoDuration item={item} />
                </td>

                {/* Size */}
                <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums truncate">
                  {item.isDir ? '—' : formatBytes(item.size)}
                </td>

                {/* Date Modified */}
                <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums truncate">
                  {formatDate(item.mtime)}
                </td>

                {/* Quick Actions (Quick Look & Open) */}
                <td className="py-1 px-2 text-center">
                  {!item.isDir && (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectItem(item);
                          onQuickLook?.(item);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600 text-gray-400 hover:text-white transition-colors"
                        title="Quick Look (Space)"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onOpenItem(item);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600 text-gray-400 hover:text-white transition-colors"
                        title="Open Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
