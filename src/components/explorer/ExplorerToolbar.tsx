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
  PanelRight,
  ArrowUpDown,
  Edit2,
  Check,
  X,
  Sun,
  Moon,
  Settings,
  Eye,
  EyeOff,
  FolderPlus,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  CopyPlus
} from 'lucide-react';
import { ViewMode, SortField, SortOrder } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { mediaService } from '../../services';
import { MacTrafficLights, MacFolderIcon } from '../common/MacIcons';
import { AfmLogo } from '../common/AfmLogo';

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
  onOpenSettings?: () => void;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;
  density?: 'compact' | 'normal' | 'broad';
  onSetDensity?: (d: 'compact' | 'normal' | 'broad') => void;
  // Pro CRUD Action Bar
  onNewFolder?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  selectedCount?: number;
  clipboardCount?: number;
  clipboardOp?: 'copy' | 'move' | null;
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
  onOpenSettings,
  showHidden = false,
  onToggleShowHidden,
  density = 'normal',
  onSetDensity,
  onNewFolder,
  onCut,
  onCopy,
  onPaste,
  onRename,
  onDelete,
  onDuplicate,
  selectedCount = 0,
  clipboardCount = 0,
  clipboardOp = null
}) => {
  const { actualTheme, setTheme } = useTheme();
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

  const toggleTheme = () => {
    setTheme(actualTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="flex flex-col border-b mac-header select-none transition-colors duration-200">
      {/* ── Main Native Command Bar ── */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 h-12">
        {/* macOS Window Traffic Lights */}
        <div className="mr-2 hidden sm:flex items-center">
          <MacTrafficLights
            onClose={() => mediaService.closeWindow()}
            onMinimize={() => mediaService.minimizeWindow()}
            onMaximize={() => mediaService.maximizeWindow()}
          />
        </div>

        {/* Anything File Manager Brand Logo & Title */}
        <div className="hidden md:flex items-center mr-1">
          <AfmLogo size={24} isOpen={true} showTitle={true} />
        </div>

        {/* Navigation Group (Back / Forward) */}
        <div className="flex items-center bg-black/5 dark:bg-white/[0.06] p-0.5 rounded-lg border border-black/10 dark:border-white/10">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 text-[var(--mac-text-primary)] transition-colors"
            title="Back (Alt+Left)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 text-[var(--mac-text-primary)] transition-colors"
            title="Forward (Alt+Right)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons: Up, Refresh, Home */}
        <div className="flex items-center gap-0.5 text-[var(--mac-text-secondary)]">
          <button
            onClick={onGoUp}
            disabled={!canGoUp}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25 hover:text-[var(--mac-text-primary)] transition-colors"
            title="Parent Folder (Alt+Up)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--mac-text-primary)] transition-colors"
            title="Refresh (F5)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onGoHome}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--mac-text-primary)] transition-colors"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Streamlined Native Breadcrumb / Address Bar */}
        <div className="flex-1 flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 focus-within:border-[var(--mac-accent)] rounded-lg px-2.5 h-8 transition-all overflow-hidden">
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="flex items-center w-full gap-2">
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-xs text-[var(--mac-text-primary)] outline-none font-mono"
                placeholder="Folder path..."
              />
              <button type="submit" className="text-emerald-500 hover:text-emerald-400 p-0.5" title="Navigate">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPathInput(currentPath);
                  setIsEditingPath(false);
                }}
                className="text-gray-400 hover:text-[var(--mac-text-primary)] p-0.5"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div
              className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full cursor-text"
              onClick={() => setIsEditingPath(true)}
              title="Click to edit path directly"
            >
              {breadcrumbs.length === 0 ? (
                <span className="text-xs text-[var(--mac-text-muted)]">Select location...</span>
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
                        className={`text-xs px-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors truncate max-w-[160px] ${
                          isLast ? 'text-[var(--mac-text-primary)] font-semibold' : 'text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
                        }`}
                      >
                        {crumb}
                      </button>
                      {!isLast && <ChevronRight className="w-3 h-3 text-[var(--mac-text-muted)] flex-shrink-0" />}
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
                className="ml-auto text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="Edit path directly"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Clean Native Search Input */}
        <div className="relative w-44 lg:w-56">
          <Search className="w-3.5 h-3.5 text-[var(--mac-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg pl-8 pr-2.5 h-8 text-xs text-[var(--mac-text-primary)] placeholder-[var(--mac-text-muted)] outline-none focus:border-[var(--mac-accent)] transition-all"
          />
        </div>

        {/* ── Native macOS Segmented View Control ── */}
        <div className="flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 p-0.5 rounded-lg">
          <button
            onClick={() => onSetViewMode('grid')}
            className={`p-1 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Icons / Grid (Ctrl+1)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetViewMode('table')}
            className={`p-1 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="List / Details (Ctrl+2)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetViewMode('columns')}
            className={`p-1 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'columns'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Columns (Ctrl+3)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetViewMode('gallery')}
            className={`p-1 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'gallery'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Gallery (Ctrl+4)"
          >
            <SquareCode className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Density / Size Resizer Control (Compact, Normal, Broad) ── */}
        <div className="hidden lg:flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 p-0.5 rounded-lg text-[11px] font-medium">
          <button
            onClick={() => onSetDensity?.('compact')}
            className={`px-2 py-1 rounded-md transition-all ${
              density === 'compact'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Compact Density"
          >
            Compact
          </button>
          <button
            onClick={() => onSetDensity?.('normal')}
            className={`px-2 py-1 rounded-md transition-all ${
              density === 'normal'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Normal Density"
          >
            Normal
          </button>
          <button
            onClick={() => onSetDensity?.('broad')}
            className={`px-2 py-1 rounded-md transition-all ${
              density === 'broad'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Broad / Large Density"
          >
            Broad
          </button>
        </div>

        {/* Minimalist Sort Control */}
        <div className="flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg px-2 h-8 gap-1 text-xs text-[var(--mac-text-secondary)]">
          <ArrowUpDown className="w-3 h-3 text-[var(--mac-text-muted)]" />
          <select
            value={sortField}
            onChange={e => onSetSort(e.target.value as SortField)}
            className="bg-transparent text-xs text-[var(--mac-text-primary)] outline-none cursor-pointer"
          >
            <option value="name" className="bg-[var(--mac-bg-card)]">Name</option>
            <option value="date" className="bg-[var(--mac-bg-card)]">Date</option>
            <option value="size" className="bg-[var(--mac-bg-card)]">Size</option>
            <option value="ext" className="bg-[var(--mac-bg-card)]">Type</option>
          </select>
          <span className="text-[10px] text-[var(--mac-text-muted)] font-mono uppercase">{sortOrder}</span>
        </div>

        {/* Inspector Toggle */}
        <button
          onClick={onToggleInspector}
          className={`p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
            isInspectorOpen
              ? 'bg-black/10 dark:bg-white/15 border-black/15 dark:border-white/20 text-[var(--mac-text-primary)] shadow-sm'
              : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
          }`}
          title="Toggle Inspector (Cmd+I or Ctrl+I)"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={`Switch to ${actualTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {actualTheme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-slate-700" />
          )}
        </button>

        {/* Toggle Hidden Items */}
        {onToggleShowHidden && (
          <button
            onClick={onToggleShowHidden}
            className={`p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border transition-colors ${
              showHidden
                ? 'bg-[var(--mac-accent)] text-white border-transparent shadow-sm'
                : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title={showHidden ? 'Hide Hidden Items (Ctrl+Shift+.)' : 'Show Hidden Items (Ctrl+Shift+.)'}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Settings */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Settings (Cmd+, or Ctrl+,)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Clean Subdued "Open Folder" Action Button */}
        <button
          onClick={onChooseFolder}
          className="flex items-center gap-1.5 px-2.5 h-8 bg-black/5 dark:bg-white/[0.08] hover:bg-black/10 dark:hover:bg-white/15 text-[var(--mac-text-primary)] border border-black/10 dark:border-white/10 rounded-lg text-xs font-medium transition-colors"
          title="Open Folder"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Open</span>
        </button>
      </div>

      {/* ── Secondary Pro File Operations Command Strip (Windows 11 / Mac Finder Hybrid) ── */}
      <div className="flex items-center justify-between px-3 py-1 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/5 text-xs text-[var(--mac-text-secondary)]">
        <div className="flex items-center gap-1 flex-wrap">
          {onNewFolder && (
            <button
              onClick={onNewFolder}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--mac-text-primary)] font-medium transition-colors"
              title="New Folder (Ctrl+Shift+N)"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-500" />
              <span>New Folder</span>
            </button>
          )}

          <div className="h-3.5 w-px bg-black/10 dark:bg-white/10 mx-1" />

          {onCut && (
            <button
              onClick={onCut}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
              title="Cut (Ctrl+X)"
            >
              <Scissors className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Cut</span>
            </button>
          )}

          {onCopy && (
            <button
              onClick={onCopy}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
              title="Copy (Ctrl+C)"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Copy</span>
            </button>
          )}

          {onPaste && (
            <button
              onClick={onPaste}
              disabled={clipboardCount === 0}
              className="relative flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
              title={`Paste (${clipboardCount} items in clipboard) (Ctrl+V)`}
            >
              <Clipboard className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Paste</span>
              {clipboardCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[var(--mac-accent)] text-white text-[10px] font-bold">
                  {clipboardCount}
                </span>
              )}
            </button>
          )}

          {onDuplicate && (
            <button
              onClick={onDuplicate}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
              title="Duplicate (Ctrl+D)"
            >
              <CopyPlus className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">Duplicate</span>
            </button>
          )}

          {onRename && (
            <button
              onClick={onRename}
              disabled={selectedCount !== 1}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
              title="Rename (F2)"
            >
              <Edit2 className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Rename</span>
            </button>
          )}

          {onDelete && (
            <button
              onClick={onDelete}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
              title="Move to Recycle Bin (Delete)"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>

        {/* Right Info Tags */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--mac-text-muted)]">
          {selectedCount > 0 && (
            <span className="font-medium text-[var(--mac-accent)]">
              {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
            </span>
          )}
          {clipboardCount > 0 && (
            <span className="bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
              Clipboard: {clipboardCount} ({clipboardOp === 'move' ? 'cut' : 'copied'})
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
