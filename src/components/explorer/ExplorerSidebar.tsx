import React from 'react';
import {
  HardDrive,
  Folder,
  Home,
  Monitor,
  Download,
  Image as ImageIcon,
  Film,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { FsItem, QuickAccessItem, DriveInfo, FilterCategory } from '../../types';
import { formatBytes } from '../../utils';

interface ExplorerSidebarProps {
  quickAccess: QuickAccessItem[];
  drivesWithSpace: DriveInfo[];
  currentPath: string;
  subfolders: FsItem[];
  filterCategory: FilterCategory;
  onSetFilterCategory: (cat: FilterCategory) => void;
  onSelectPath: (path: string) => void;
  width?: number;
}

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({
  quickAccess,
  drivesWithSpace,
  currentPath,
  subfolders,
  filterCategory,
  onSetFilterCategory,
  onSelectPath,
  width = 250
}) => {
  const getIconForQuickAccess = (icon: string) => {
    switch (icon) {
      case 'home':
        return <Home className="w-4 h-4 text-sky-400" />;
      case 'desktop':
        return <Monitor className="w-4 h-4 text-indigo-400" />;
      case 'downloads':
        return <Download className="w-4 h-4 text-emerald-400" />;
      case 'pictures':
        return <ImageIcon className="w-4 h-4 text-rose-400" />;
      case 'videos':
        return <Film className="w-4 h-4 text-purple-400" />;
      case 'documents':
        return <FileText className="w-4 h-4 text-amber-400" />;
      default:
        return <Folder className="w-4 h-4 text-gray-400" />;
    }
  };

  const isPathActive = (p: string) => {
    if (!currentPath || !p) return false;
    const normCur = currentPath.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
    const normP = p.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
    return normCur === normP;
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className="flex-shrink-0 border-r border-white/10 bg-[#0e1017] overflow-y-auto flex flex-col p-3 select-none text-gray-300"
    >
      {/* macOS Window Traffic Lights Header */}
      <div className="flex items-center gap-2 px-2 pt-1 pb-4 border-b border-white/5 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] shadow-sm hover:opacity-80 transition-opacity cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] shadow-sm hover:opacity-80 transition-opacity cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] shadow-sm hover:opacity-80 transition-opacity cursor-pointer" />
        </div>
        <span className="text-[11px] font-bold text-gray-400 tracking-wider ml-2 uppercase">
          Finder & Explorer
        </span>
      </div>

      {/* ── Section 1: Favorites / Quick Access (Mac Finder & Win Explorer) ── */}
      <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
        <span>Favorites</span>
      </div>
      <div className="space-y-0.5 mb-4">
        {quickAccess.map(item => {
          const active = isPathActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => onSelectPath(item.path)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-md font-semibold'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {getIconForQuickAccess(item.icon)}
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* ── Section 2: Drives & Storage (Windows Explorer Capacity Bars) ── */}
      <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
        <span>Locations</span>
      </div>
      <div className="space-y-1.5 mb-4">
        {drivesWithSpace.map(d => {
          const active = currentPath.toLowerCase().startsWith(d.drive.toLowerCase());
          return (
            <button
              key={d.drive}
              onClick={() => onSelectPath(d.drive)}
              className={`w-full flex flex-col p-2 rounded-xl text-xs transition-all ${
                active
                  ? 'bg-indigo-600/15 border border-indigo-500/40 text-indigo-200'
                  : 'border border-white/5 bg-white/[0.02] text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2 font-semibold">
                  <HardDrive className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-gray-400'}`} />
                  <span className="text-gray-200">Local Disk ({d.drive.replace(/\\/g, '')})</span>
                </div>
                {d.total > 0 && (
                  <span className="text-[10px] text-gray-500 font-mono">
                    {d.usedPercent}%
                  </span>
                )}
              </div>
              {/* Windows-style mini progress bar */}
              {d.total > 0 && (
                <div className="w-full">
                  <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        d.usedPercent > 90
                          ? 'bg-rose-500'
                          : d.usedPercent > 75
                          ? 'bg-amber-400'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${d.usedPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>{formatBytes(d.free)} free</span>
                    <span>{formatBytes(d.total)}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Section 3: Smart Tags & Filters (macOS Smart Folders) ── */}
      <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        <span>Smart Media</span>
      </div>
      <div className="space-y-0.5 mb-4">
        <button
          onClick={() => onSetFilterCategory('all')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'all'
              ? 'bg-white/10 text-white font-semibold'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>All Assets</span>
          </div>
        </button>
        <button
          onClick={() => onSetFilterCategory('photo')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'photo'
              ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Photos & Raw</span>
          </div>
        </button>
        <button
          onClick={() => onSetFilterCategory('video')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'video'
              ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Videos</span>
          </div>
        </button>
        <button
          onClick={() => onSetFilterCategory('timelapse')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterCategory === 'timelapse'
              ? 'bg-amber-600/20 text-amber-300 font-semibold border border-amber-500/30'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Timelapses (&lt; 60s)</span>
          </div>
        </button>
      </div>

      {/* ── Section 4: Current Subfolders Directory Tree ── */}
      {subfolders.length > 0 && (
        <>
          <div className="px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span>Subfolders ({subfolders.length})</span>
          </div>
          <div className="space-y-0.5 overflow-y-auto max-h-48 pr-1">
            {subfolders.map(i => (
              <button
                key={i.fullPath}
                onClick={() => onSelectPath(i.fullPath)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all truncate text-left"
                title={i.name}
              >
                <Folder className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
                <span className="truncate">{i.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
