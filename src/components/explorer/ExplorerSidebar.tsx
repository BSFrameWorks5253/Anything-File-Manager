import React from 'react';
import { HardDrive, Folder } from 'lucide-react';
import { FsItem } from '../../types';

interface ExplorerSidebarProps {
  drives: string[];
  currentPath: string;
  subfolders: FsItem[];
  onSelectDrive: (drive: string) => void;
  onSelectFolder: (fullPath: string) => void;
}

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({
  drives,
  currentPath,
  subfolders,
  onSelectDrive,
  onSelectFolder
}) => {
  return (
    <div className="w-60 flex-shrink-0 border-r border-white/10 bg-[#10121a] overflow-y-auto flex flex-col p-2">
      <div className="px-2 pt-2 pb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
        Drives
      </div>
      {drives.map(d => (
        <button
          key={d}
          onClick={() => onSelectDrive(d)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            currentPath.startsWith(d)
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <HardDrive className="w-4 h-4 text-indigo-400" />
          <span>{d}</span>
        </button>
      ))}

      <div className="mt-4 px-2 pb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
        Subfolders
      </div>
      {subfolders.map(i => (
        <button
          key={i.fullPath}
          onClick={() => onSelectFolder(i.fullPath)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all truncate"
          title={i.name}
        >
          <Folder className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
          <span className="truncate">{i.name}</span>
        </button>
      ))}
    </div>
  );
};
