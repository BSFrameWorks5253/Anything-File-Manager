import React from 'react';
import { Folder, File, Film, Image as ImageIcon } from 'lucide-react';
import { FsItem } from '../../types';
import { isPhotoExtension, isVideoExtension, formatBytes, formatDate } from '../../utils';

interface ExplorerTableProps {
  items: FsItem[];
  selectedPath: string | null;
  onSelectItem: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
}

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  items,
  selectedPath,
  onSelectItem,
  onOpenItem
}) => {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] text-gray-500 uppercase border-b border-white/10">
          <th className="text-left py-2 px-3 font-semibold">Name</th>
          <th className="text-left py-2 px-3 font-semibold w-24">Type</th>
          <th className="text-right py-2 px-3 font-semibold w-28">Size</th>
          <th className="text-right py-2 px-3 font-semibold w-48">Date Modified</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr
            key={item.fullPath}
            onClick={() => onSelectItem(item)}
            onDoubleClick={() => onOpenItem(item)}
            className={`cursor-pointer hover:bg-white/5 rounded-lg transition-colors ${
              selectedPath === item.fullPath ? 'bg-indigo-500/15 text-indigo-200' : ''
            }`}
          >
            <td className="py-2 px-3">
              <div className="flex items-center gap-2.5">
                {item.isDir ? (
                  <Folder className="w-4 h-4 text-amber-400" />
                ) : isPhotoExtension(item.ext) ? (
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                ) : isVideoExtension(item.ext) ? (
                  <Film className="w-4 h-4 text-purple-400" />
                ) : (
                  <File className="w-4 h-4 text-gray-400" />
                )}
                <span className="truncate max-w-lg font-medium">{item.name}</span>
              </div>
            </td>
            <td className="py-2 px-3 text-xs uppercase text-gray-400">
              {item.isDir ? 'Folder' : item.ext}
            </td>
            <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums">
              {item.isDir ? '—' : formatBytes(item.size)}
            </td>
            <td className="py-2 px-3 text-right text-gray-400 text-xs tabular-nums">
              {formatDate(item.mtime)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
