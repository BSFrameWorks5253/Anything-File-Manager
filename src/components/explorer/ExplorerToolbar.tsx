import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Home,
  ChevronRight,
  Search,
  LayoutGrid,
  List,
  Columns,
  SquareCode,
  FolderOpen,
  ShieldCheck,
  PanelRight,
  ArrowUpDown,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { ViewMode, SortField, SortOrder } from '../../types';

interface ExplorerToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onGoHome: () => void;
  currentPath: string;
  breadcrumbs: string[];
  onNavigateBreadcrumb: (path: string) => void;
  onNavigateDirectPath: (path: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSetSort: (field: SortField) => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onChooseFolder: () => void;
  onOpenDefaultAppsModal?: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  canGoBack,
  canGoForward,
  canGoUp,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
  onGoHome,
  currentPath,
  breadcrumbs,
  onNavigateBreadcrumb,
  onNavigateDirectPath,
  search,
  onSearchChange,
  viewMode,
  onSetViewMode,
  sortField,
  sortOrder,
  onSetSort,
  isInspectorOpen,
  onToggleInspector,
  onChooseFolder,
  onOpenDefaultAppsModal
}) => {
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(currentPath);

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      onNavigateDirectPath(pathInput.trim());
    }
    setIsEditingPath(false);
  };

  return (
    <div className="flex flex-col border-b border-white/10 bg-[#12141c] select-none text-gray-200">
      {/* ── Top Command Bar ── */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Windows Explorer Style History Navigation */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-colors"
            title="Back (Alt+Left)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-colors"
            title="Forward (Alt+Right)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onGoUp}
            disabled={!canGoUp}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-colors"
            title="Up to Parent Folder (Alt+Up)"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
            title="Refresh (F5)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onGoHome}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Windows Explorer Address Bar + Editable Path */}
        <div className="flex-1 flex items-center bg-black/40 border border-white/10 hover:border-indigo-500/40 focus-within:border-indigo-500 rounded-xl px-3 py-1.5 transition-all shadow-inner overflow-hidden">
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="flex items-center w-full gap-2">
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-xs text-white outline-none font-mono"
                placeholder="Type or paste a folder path..."
              />
              <button type="submit" className="text-emerald-400 hover:text-emerald-300 p-0.5">
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPathInput(currentPath);
                  setIsEditingPath(false);
                }}
                className="text-gray-400 hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div
              className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full cursor-text"
              onClick={() => setIsEditingPath(true)}
              title="Click to edit path directly"
            >
              {breadcrumbs.length === 0 ? (
                <span className="text-xs text-gray-500">Select a location...</span>
              ) : (
                breadcrumbs.map((crumb, idx) => {
                  const pathUpTo = breadcrumbs.slice(0, idx + 1).join('\\');
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={pathUpTo}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onNavigateBreadcrumb(pathUpTo.includes(':') && !pathUpTo.includes('\\') ? pathUpTo + '\\' : pathUpTo);
                        }}
                        className={`text-xs px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors truncate max-w-[150px] ${
                          isLast ? 'text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {crumb}
                      </button>
                      {!isLast && <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                    </React.Fragment>
                  );
                })
              )}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsEditingPath(true);
                }}
                className="ml-auto text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-white/10"
                title="Edit path directly"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Search Bar with Instant Filter */}
        <div className="relative w-48 lg:w-60">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search media..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:bg-white/10 transition-all"
          />
        </div>

        {/* ── macOS Finder Style Segmented View Switcher ── */}
        <div className="flex items-center bg-black/40 border border-white/10 p-1 rounded-xl">
          <button
            onClick={() => onSetViewMode('grid')}
            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Icons / Grid View (Ctrl+1)"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetViewMode('table')}
            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
            title="List / Details View (Ctrl+2)"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetViewMode('columns')}
            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
              viewMode === 'columns'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Columns View - macOS Finder Miller Columns (Ctrl+3)"
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetViewMode('gallery')}
            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
              viewMode === 'gallery'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Gallery View - Stage & Filmstrip (Ctrl+4)"
          >
            <SquareCode className="w-4 h-4" />
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-2 py-1 gap-1 text-xs text-gray-300">
          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
          <select
            value={sortField}
            onChange={e => onSetSort(e.target.value as SortField)}
            className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
          >
            <option value="name" className="bg-[#141620]">Name</option>
            <option value="date" className="bg-[#141620]">Date</option>
            <option value="size" className="bg-[#141620]">Size</option>
            <option value="ext" className="bg-[#141620]">Type</option>
          </select>
          <span className="text-[10px] text-indigo-400 font-bold uppercase">{sortOrder}</span>
        </div>

        {/* Details / Inspector Pane Toggle */}
        <button
          onClick={onToggleInspector}
          className={`p-2 rounded-xl border transition-all ${
            isInspectorOpen
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-md'
              : 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle Inspector / Details Pane (Alt+P or Cmd+I)"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Open Folder Button */}
        <button
          onClick={onChooseFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all hover:scale-105"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Open Folder</span>
        </button>

        {/* Default Apps Modal Trigger */}
        {onOpenDefaultAppsModal && (
          <button
            onClick={onOpenDefaultAppsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white text-xs font-bold rounded-xl border border-indigo-500/30 transition-all shadow-sm hover:scale-105 active:scale-95"
            title="Windows Default Apps & Explorer Thumbnails Setup"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Default</span>
          </button>
        )}
      </div>
    </div>
  );
};
