import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Home,
  ChevronRight,
  ImageIcon,
  Film,
  Clock,
  Search,
  LayoutGrid,
  List,
  FolderOpen,
  ShieldCheck
} from 'lucide-react';
import { FilterCategory, ViewMode } from '../../types';

interface ExplorerToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onRefresh: () => void;
  onGoHome: () => void;
  breadcrumbs: string[];
  onNavigateBreadcrumb: (path: string) => void;
  filterCategory: FilterCategory;
  onSetFilterCategory: (cat: FilterCategory) => void;
  search: string;
  onSearchChange: (val: string) => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  onChooseFolder: () => void;
  onOpenDefaultAppsModal?: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onRefresh,
  onGoHome,
  breadcrumbs,
  onNavigateBreadcrumb,
  filterCategory,
  onSetFilterCategory,
  search,
  onSearchChange,
  viewMode,
  onSetViewMode,
  onChooseFolder,
  onOpenDefaultAppsModal
}) => {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-[#12141c]">
      {/* App Logo & Branding */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white text-sm shadow-md">
          MV
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white tracking-wide leading-tight">MediaView Studio</span>
          <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Anything Suite</span>
        </div>
      </div>

      {/* History Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onGoBack}
          disabled={!canGoBack}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onGoForward}
          disabled={!canGoForward}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Breadcrumb Path */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto text-sm px-2">
        <button onClick={onGoHome} className="text-gray-400 hover:text-white">
          <Home className="w-3.5 h-3.5" />
        </button>
        {breadcrumbs.map((seg, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <button
              onClick={() => {
                const p = breadcrumbs.slice(0, idx + 1).join('/') + '/';
                onNavigateBreadcrumb(p);
              }}
              className="hover:text-white text-gray-300 font-medium truncate max-w-[150px]"
            >
              {seg}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Filter Category Pills */}
      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-xs font-semibold">
        <button
          onClick={() => onSetFilterCategory('all')}
          className={`px-2.5 py-1 rounded-lg transition-all ${
            filterCategory === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onSetFilterCategory('photo')}
          className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
            filterCategory === 'photo' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-3 h-3" /> Photos
        </button>
        <button
          onClick={() => onSetFilterCategory('video')}
          className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
            filterCategory === 'video' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Film className="w-3 h-3" /> Videos
        </button>
        <button
          onClick={() => onSetFilterCategory('timelapse')}
          className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
            filterCategory === 'timelapse' ? 'bg-amber-600 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
          title="Timelapses & Short Videos (≤ 60s)"
        >
          <Clock className="w-3 h-3" /> Timelapses
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search media..."
          className="bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1 text-sm focus:outline-none focus:border-indigo-500 text-gray-200 w-44"
        />
      </div>

      {/* View Switcher */}
      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
        <button
          onClick={() => onSetViewMode('grid')}
          className={`p-1.5 rounded-lg ${
            viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="Grid / Thumbnails"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSetViewMode('table')}
          className={`p-1.5 rounded-lg ${
            viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          title="List / Details"
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Native Folder Picker */}
      <button
        onClick={onChooseFolder}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all hover:scale-105"
      >
        <FolderOpen className="w-4 h-4" />
        <span>Open Folder</span>
      </button>

      {/* Set as Default Viewer Button */}
      {onOpenDefaultAppsModal && (
        <button
          onClick={onOpenDefaultAppsModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white text-xs font-bold rounded-xl border border-indigo-500/30 transition-all shadow-sm hover:scale-105 active:scale-95"
          title="Set as Default Windows Viewer & Enable Explorer Thumbnails"
        >
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Default Viewer</span>
        </button>
      )}
    </div>
  );
};
