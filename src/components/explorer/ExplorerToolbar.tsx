import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Columns,
  SquareCode,
  FolderOpen,
  PanelLeft,
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
  CopyPlus,
  MoreHorizontal,
  Info,
  Film
} from 'lucide-react';
import { ViewMode, SortField, SortOrder } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { mediaService } from '../../services';
import { MacTrafficLights, MacFolderIcon } from '../common/MacIcons';

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
  onOpenProperties?: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  onChooseFolder: () => void;
  onOpenSettings?: () => void;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;
  density?: 'compact' | 'normal' | 'broad';
  onSetDensity?: (d: 'compact' | 'normal' | 'broad') => void;
  // File CRUD Operations
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
  onOpenSequenceMaker?: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  canGoBack,
  canGoForward,
  canGoUp,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
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
  onOpenProperties,
  isInspectorOpen,
  onToggleInspector,
  isSidebarVisible = true,
  onToggleSidebar,
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
  clipboardOp = null,
  onOpenSequenceMaker
}) => {
  const { actualTheme, setTheme } = useTheme();
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(currentPath);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState<{ name: string; username: string; avatar?: string | null } | null>(null);

  useEffect(() => {
    const api = (window as any).mediaViewerAPI || (window as any).electronAPI || (window as any).api;
    const loadProfile = () => {
      if (api?.userProfile?.load) {
        api.userProfile.load().then((p: any) => {
          if (p && (p.name || p.username || p.email)) {
            setUserProfile({
              name: p.name || 'Creator',
              username: p.username || (p.email ? p.email.split('@')[0] : 'creator'),
              avatar: p.avatar || p.avatarBase64 || null
            });
          }
        }).catch(() => {});
      }
    };
    loadProfile();
    const poll = setInterval(loadProfile, 4000);
    window.addEventListener('storage', loadProfile);
    window.addEventListener('anything:ecosystem-auth-change', loadProfile);
    window.addEventListener('focus', loadProfile);
    return () => {
      clearInterval(poll);
      window.removeEventListener('storage', loadProfile);
      window.removeEventListener('anything:ecosystem-auth-change', loadProfile);
      window.removeEventListener('focus', loadProfile);
    };
  }, []);

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    if (isActionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionMenuOpen]);

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = pathInput.trim();
    if (trimmed) {
      if (/^[a-zA-Z]:$/.test(trimmed)) {
        trimmed = trimmed + '\\';
      }
      trimmed = trimmed.replace(/\//g, '\\');
      onNavigateDirectPath(trimmed);
    }
    setIsEditingPath(false);
  };

  const toggleTheme = () => {
    setTheme(actualTheme === 'dark' ? 'light' : 'dark');
  };

  // Get display folder name
  const currentFolderName = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : 'Finder';

  return (
    <header className="flex items-center justify-between px-3 h-[52px] border-b border-[var(--mac-border)] mac-header select-none transition-colors duration-200 z-30">
      {/* ── Left Group: Traffic Lights + Sidebar Toggle + Nav Segments ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* macOS Window Traffic Lights */}
        <div className="mr-2 hidden sm:flex items-center">
          <MacTrafficLights
            onClose={() => mediaService.closeWindow()}
            onMinimize={() => mediaService.minimizeWindow()}
            onMaximize={() => mediaService.maximizeWindow()}
          />
        </div>

        {/* Sidebar Toggle Button (macOS Sonoma / Sequoia style) */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-md transition-colors ${
              isSidebarVisible
                ? 'text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Toggle Sidebar (Cmd+Option+S)"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Navigation Segmented Control: Back / Forward */}
        <div className="inline-flex items-center bg-black/5 dark:bg-white/[0.06] rounded-md border border-black/10 dark:border-white/10 p-0.5">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 text-[var(--mac-text-primary)] transition-colors"
            title="Back (Cmd+[ or Alt+Left)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 text-[var(--mac-text-primary)] transition-colors"
            title="Forward (Cmd+] or Alt+Right)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Up to Parent Folder Button */}
        <button
          onClick={onGoUp}
          disabled={!canGoUp}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-20 text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] transition-colors"
          title="Parent Folder (Cmd+Up or Alt+Up)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] transition-colors"
          title="Refresh (Cmd+R or F5)"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Center: Proxy Icon & Current Folder Name (macOS Finder style) ── */}
      <div className="flex-1 max-w-xl mx-3 flex items-center justify-center">
        {isEditingPath ? (
          <form onSubmit={handlePathSubmit} className="flex items-center w-full gap-1.5 bg-black/5 dark:bg-white/[0.06] border border-[var(--mac-accent)] rounded-lg px-2.5 h-8">
            <input
              type="text"
              value={pathInput}
              onChange={e => setPathInput(e.target.value)}
              autoFocus
              className="w-full bg-transparent text-xs text-[var(--mac-text-primary)] outline-none font-mono"
              placeholder="Enter folder path..."
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
            onClick={() => setIsEditingPath(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer group transition-colors max-w-full overflow-hidden"
            title="Click to edit folder path directly"
          >
            <MacFolderIcon size={17} className="flex-shrink-0" />
            <span className="text-xs font-semibold text-[var(--mac-text-primary)] truncate max-w-[220px]">
              {currentFolderName}
            </span>
            <Edit2 className="w-3 h-3 text-[var(--mac-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* ── Right Group: View Switcher + Density + Sort + Action Menu + Search + Info ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* macOS Segmented View Mode Picker */}
        <div className="inline-flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 p-0.5 rounded-lg">
          <button
            onClick={() => onSetViewMode('grid')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Icons / Grid (Cmd+1 or Ctrl+1)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetViewMode('table')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="List / Details (Cmd+2 or Ctrl+2)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetViewMode('columns')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'columns'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Columns (Cmd+3 or Ctrl+3)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetViewMode('gallery')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'gallery'
                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-xs font-semibold'
                : 'text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Gallery (Cmd+4 or Ctrl+4)"
          >
            <SquareCode className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Minimalist Sort Control */}
        <div className="hidden sm:flex items-center bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg px-2 h-8 gap-1 text-xs text-[var(--mac-text-secondary)]">
          <ArrowUpDown className="w-3 h-3 text-[var(--mac-text-muted)]" />
          <select
            value={sortField}
            onChange={e => onSetSort(e.target.value as SortField)}
            className="bg-transparent text-xs text-[var(--mac-text-primary)] outline-none cursor-pointer"
          >
            <option value="name" className="bg-[var(--mac-bg-card)]">Name</option>
            <option value="date" className="bg-[var(--mac-bg-card)]">Date</option>
            <option value="size" className="bg-[var(--mac-bg-card)]">Size</option>
            <option value="ext" className="bg-[var(--mac-bg-card)]">Kind</option>
          </select>
        </div>

        {/* Quick New Folder button */}
        {onNewFolder && (
          <button
            onClick={onNewFolder}
            className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="New Folder (Cmd+Shift+N or Ctrl+Shift+N)"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-500" />
          </button>
        )}

        {/* 🎬 Premiere Pro Project In-App Overlay Trigger */}
        {onOpenSequenceMaker && (
          <button
            onClick={onOpenSequenceMaker}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Generate Premiere Pro Project (F8) - Directly inside AFM"
          >
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">Premiere Project</span>
          </button>
        )}

        {/* ── macOS Action Menu [ ⋯ ] ── */}
        <div className="relative" ref={actionMenuRef}>
          <button
            onClick={() => setIsActionMenuOpen(prev => !prev)}
            className={`p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
              isActionMenuOpen
                ? 'bg-black/10 dark:bg-white/15 border-black/15 dark:border-white/20 text-[var(--mac-text-primary)]'
                : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
            }`}
            title="Action Menu"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {isActionMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-[var(--mac-border)] mac-menu shadow-2xl py-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              {onNewFolder && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onNewFolder();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>New Folder</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+Shift+N</span>
                </button>
              )}

              <div className="h-px bg-black/5 dark:bg-white/10 my-1" />

              {onCut && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onCut();
                  }}
                  disabled={selectedCount === 0}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cut</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+X</span>
                </button>
              )}

              {onCopy && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onCopy();
                  }}
                  disabled={selectedCount === 0}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+C</span>
                </button>
              )}

              {onPaste && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onPaste();
                  }}
                  disabled={clipboardCount === 0}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Paste {clipboardCount > 0 ? `(${clipboardCount})` : ''}</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+V</span>
                </button>
              )}

              {onDuplicate && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onDuplicate();
                  }}
                  disabled={selectedCount === 0}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CopyPlus className="w-3.5 h-3.5" />
                    <span>Duplicate</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+D</span>
                </button>
              )}

              {onRename && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onRename();
                  }}
                  disabled={selectedCount !== 1}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white disabled:opacity-30 disabled:pointer-events-none text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </div>
                  <span className="text-[10px] opacity-60">F2</span>
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onDelete();
                  }}
                  disabled={selectedCount === 0}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-500 hover:text-white text-red-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Move to Trash</span>
                  </div>
                  <span className="text-[10px] opacity-60">Delete</span>
                </button>
              )}

              <div className="h-px bg-black/5 dark:bg-white/10 my-1" />


              {onOpenSequenceMaker && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onOpenSequenceMaker();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-purple-500" />
                    <span className="font-semibold text-purple-600 dark:text-purple-300">One Tap Sequence Maker...</span>
                  </div>
                </button>
              )}
              {onToggleShowHidden && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onToggleShowHidden();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{showHidden ? 'Hide Hidden Files' : 'Show Hidden Files'}</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+Shift+.</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsActionMenuOpen(false);
                  toggleTheme();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white text-[var(--mac-text-primary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {actualTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{actualTheme === 'dark' ? 'Light Appearance' : 'Dark Appearance'}</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsActionMenuOpen(false);
                  onChooseFolder();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white text-[var(--mac-text-primary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Folder...</span>
                </div>
              </button>

              {onOpenSettings && (
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--mac-accent)] hover:text-white text-[var(--mac-text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+,</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* macOS Search Pill Capsule */}
        <div className="relative w-36 lg:w-48">
          <Search className="w-3.5 h-3.5 text-[var(--mac-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-full pl-7 pr-6 h-7.5 text-xs text-[var(--mac-text-primary)] placeholder-[var(--mac-text-muted)] outline-none focus:border-[var(--mac-accent)] transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--mac-text-primary)] p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* macOS Info / Inspector Toggle Button */}
        <button
          onClick={() => onOpenProperties ? onOpenProperties() : onToggleInspector()}
          className={`p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
            isInspectorOpen
              ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-xs'
              : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.06] text-[var(--mac-text-secondary)] hover:text-[var(--mac-text-primary)]'
          }`}
          title="Get Info / Properties (Ctrl+I or Cmd+I)"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* User Identity & PFP Pill */}
        {userProfile && (
          <div
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 select-none shrink-0"
            title={`${userProfile.name} (@${userProfile.username})`}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] text-white bg-gradient-to-tr from-cyan-500 to-indigo-600 shrink-0 shadow-xs border border-white/20">
              {userProfile.avatar ? (
                <img src={userProfile.avatar} alt={userProfile.name} className="w-full h-full object-cover" />
              ) : (
                <span>{userProfile.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col leading-none max-w-[110px] hidden sm:flex">
              <span className="text-[11px] font-semibold text-[var(--mac-text-primary)] truncate">
                {userProfile.name}
              </span>
              <span className="text-[9px] font-mono text-[var(--mac-accent)] truncate">
                @{userProfile.username}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
