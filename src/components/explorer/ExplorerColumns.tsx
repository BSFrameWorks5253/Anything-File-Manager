import React, { useState, useEffect } from 'react';
import {
  Folder,
  ChevronRight,
  Film,
  Image as ImageIcon,
  File,
  Clock,
  Maximize2
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

interface ColumnLevel {
  path: string;
  items: FsItem[];
  selectedItem: FsItem | null;
}

interface ExplorerColumnsProps {
  currentPath: string;
  initialItems: FsItem[];
  onSelectItem: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
}

export const ExplorerColumns: React.FC<ExplorerColumnsProps> = ({
  currentPath,
  initialItems,
  onSelectItem,
  onOpenItem
}) => {
  const [columns, setColumns] = useState<ColumnLevel[]>([]);
  const [previewItem, setPreviewItem] = useState<FsItem | null>(null);
  const [previewThumb, setPreviewThumb] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number>(0);

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

  // Handle clicking an item in a specific column index
  const handleColumnClick = async (columnIndex: number, item: FsItem) => {
    onSelectItem(item);

    // Truncate subsequent columns
    const nextCols = columns.slice(0, columnIndex + 1);
    nextCols[columnIndex].selectedItem = item;

    if (item.isDir) {
      setPreviewItem(null);
      // Load child folder into next column
      const subItems = await mediaService.listDir(item.fullPath);
      nextCols.push({
        path: item.fullPath,
        items: subItems,
        selectedItem: null
      });
      setColumns(nextCols);
    } else {
      // File selected - show preview in final pane
      setColumns(nextCols);
      setPreviewItem(item);

      if (isVideoExtension(item.ext) || isRawExtension(item.ext)) {
        const cached = thumbnailService.getCached(item.fullPath);
        if (cached) {
          setPreviewThumb(cached.thumb);
          setPreviewDuration(cached.duration);
        } else {
          thumbnailService.extractVideoThumbnail(item.fullPath).then(res => {
            if (res) {
              setPreviewThumb(res.thumb);
              setPreviewDuration(res.duration);
            }
          });
        }
      }
    }
  };

  return (
    <div className="flex h-full overflow-x-auto no-scrollbar bg-[#0d0f15] select-none">
      {columns.map((col, colIdx) => (
        <div
          key={col.path + colIdx}
          className="w-64 min-w-[250px] border-r border-white/10 flex flex-col h-full bg-[#11131c]"
        >
          {/* Column Header */}
          <div className="px-3 py-2 border-b border-white/5 bg-[#141622] text-[11px] font-bold text-gray-400 truncate flex items-center justify-between">
            <span className="truncate">{col.path.split(/[\\/]/).filter(Boolean).pop() || col.path}</span>
            <span className="text-[10px] text-gray-500 font-mono">{col.items.length} items</span>
          </div>

          {/* Column Items List */}
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {col.items.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-600">Empty folder</div>
            ) : (
              col.items.map(item => {
                const isSelected = col.selectedItem?.fullPath === item.fullPath;
                const isPhoto = isPhotoExtension(item.ext);
                const isVideo = isVideoExtension(item.ext);

                return (
                  <button
                    key={item.fullPath}
                    onClick={() => handleColumnClick(colIdx, item)}
                    onDoubleClick={() => onOpenItem(item)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-medium shadow-md'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-1">
                      {item.isDir ? (
                        <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-amber-400'}`} />
                      ) : isPhoto ? (
                        <ImageIcon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />
                      ) : isVideo ? (
                        <Film className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-purple-400'}`} />
                      ) : (
                        <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.isDir ? (
                        <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                      ) : (
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>
                          {formatBytes(item.size)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ))}

      {/* ── macOS Finder Style Preview Column (When file selected) ── */}
      {previewItem && (
        <div className="w-80 min-w-[300px] border-r border-white/10 flex flex-col h-full bg-[#131622] p-4 select-none">
          <div className="aspect-video w-full bg-black/60 rounded-xl overflow-hidden flex items-center justify-center relative shadow-lg border border-white/10 mb-4">
            {isRawExtension(previewItem.ext) ? (
              previewThumb ? (
                <img
                  src={previewThumb}
                  alt={previewItem.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-rose-400">
                  <ImageIcon className="w-12 h-12 opacity-60 animate-pulse" />
                  <span className="text-[10px] font-bold text-rose-300 mt-1 uppercase">RAW Preview</span>
                </div>
              )
            ) : isPhotoExtension(previewItem.ext) ? (
              <img
                src={mediaService.toLocalResourceUrl(previewItem.fullPath)}
                alt={previewItem.name}
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
                <Film className="w-12 h-12 text-indigo-400 opacity-60 animate-pulse" />
              )
            ) : (
              <File className="w-16 h-16 text-gray-500" />
            )}

            {isVideoExtension(previewItem.ext) && previewDuration > 0 && (
              <span className="absolute bottom-2 right-2 bg-black/85 text-amber-300 border border-amber-400/40 text-[11px] font-bold px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatTimelapse(previewDuration)}
              </span>
            )}
          </div>

          <span className="text-sm font-bold text-white break-words mb-1">
            {previewItem.name}
          </span>
          <span className="text-xs text-indigo-400 uppercase font-semibold mb-3">
            {previewItem.ext || 'File'}
          </span>

          <div className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Size</span>
              <span className="font-mono">{formatBytes(previewItem.size)}</span>
            </div>
            {isVideoExtension(previewItem.ext) && previewDuration > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-bold text-amber-300">{formatTimelapse(previewDuration)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Kind</span>
              <span className="uppercase">{previewItem.ext}</span>
            </div>
          </div>

          <button
            onClick={() => onOpenItem(previewItem)}
            className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Open & Zoom</span>
          </button>
        </div>
      )}
    </div>
  );
};
