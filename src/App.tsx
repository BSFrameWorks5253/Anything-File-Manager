import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Film, RefreshCw } from 'lucide-react';
import { FsItem, FilterCategory, ViewMode, SortField, SortOrder } from './types';
import { isPhotoExtension, isVideoExtension } from './utils';
import { mediaService, thumbnailService } from './services';
import { useMediaNavigation } from './hooks';
import {
  ExplorerSidebar,
  ExplorerToolbar,
  ExplorerGrid,
  ExplorerTable,
  ExplorerColumns,
  ExplorerGallery,
  ExplorerInspector,
  QuickLookModal,
  ExplorerStatusBar,
  ExplorerTabBar,
  TabData
} from './components/explorer';
import { ExplorerContextMenu, ContextMenuState } from './components/explorer/ExplorerContextMenu';
import { FullscreenViewer } from './components/viewer';
import { MacStandaloneMediaPlayer } from './components/viewer/MacStandaloneMediaPlayer';
import { DefaultAppsModal, SettingsModal, PropertiesModal } from './components/modals';

export default function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const isPlayerWindow = queryParams.get('player') === '1';
  const playerFile = queryParams.get('file');

  if (isPlayerWindow && playerFile) {
    return <MacStandaloneMediaPlayer filePath={playerFile} />;
  }

  const {
    drives,
    drivesWithSpace,
    quickAccess,
    currentPath,
    items,
    loading,
    navigate,
    refresh,
    goBack,
    goForward,
    goUp,
    canGoBack,
    canGoForward,
    canGoUp,
    breadcrumbs
  } = useMediaNavigation();

  // Multi-Tab State
  const [tabs, setTabs] = useState<TabData[]>([
    { id: 'tab-1', title: 'Home', path: '' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // Filter & View State
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedItemState, setSelectedItemState] = useState<FsItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [density, setDensity] = useState<'compact' | 'normal' | 'broad'>('normal');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isQuickLookOpen, setIsQuickLookOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<FsItem | null>(null);
  const [isDefaultAppsModalOpen, setIsDefaultAppsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState<FsItem | null>(null);

  // Pro CRUD & Multi-Selection State
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ paths: string[]; operation: 'copy' | 'move' } | null>(null);
  const [colorTags, setColorTags] = useState<Record<string, string>>({});
  const [selectedTagColor, setSelectedTagColor] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null
  });

  const [showHidden, setShowHidden] = useState<boolean>(() => {
    return localStorage.getItem('media-viewer-show-hidden') === 'true';
  });

  const handleToggleShowHidden = useCallback(() => {
    setShowHidden(prev => {
      const next = !prev;
      localStorage.setItem('media-viewer-show-hidden', String(next));
      return next;
    });
  }, []);

  // Resizable sidebar and inspector widths
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [inspectorWidth, setInspectorWidth] = useState(320);

  // Synchronize active tab path with navigation
  useEffect(() => {
    if (currentPath) {
      setTabs(prev =>
        prev.map(tab => {
          if (tab.id === activeTabId) {
            const folderName = currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath;
            return { ...tab, path: currentPath, title: folderName };
          }
          return tab;
        })
      );
    }
  }, [currentPath, activeTabId]);

  // Load color tags
  useEffect(() => {
    mediaService.getFileTags().then(tags => {
      if (tags) setColorTags(tags);
    });
  }, [currentPath]);

  // Filter items by category & search term
  const filteredItems = useMemo(() => {
    let list = items;
    if (!showHidden) {
      list = list.filter(i => !i.isHidden);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    if (filterCategory === 'photo') {
      list = list.filter(i => i.isDir || isPhotoExtension(i.ext));
    } else if (filterCategory === 'video') {
      list = list.filter(i => i.isDir || isVideoExtension(i.ext));
    } else if (filterCategory === 'timelapse') {
      list = list.filter(i => {
        if (i.isDir) return true;
        if (!isVideoExtension(i.ext)) return false;
        const cached = thumbnailService.getCached(i.fullPath);
        return cached ? cached.duration <= 60 : true;
      });
    }

    if (selectedTagColor) {
      list = list.filter(i => colorTags[i.fullPath]?.toLowerCase() === selectedTagColor.toLowerCase());
    }

    // Sort items (folders always on top)
    return [...list].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'date') {
        cmp = a.mtime - b.mtime;
      } else if (sortField === 'size') {
        cmp = a.size - b.size;
      } else if (sortField === 'ext') {
        cmp = a.ext.localeCompare(b.ext);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [items, search, filterCategory, sortField, sortOrder, showHidden]);

  // Selected item object (reliable across folders and columns)
  const selectedItem = useMemo(() => {
    if (selectedItemState && selectedItemState.fullPath === selectedPath) {
      return selectedItemState;
    }
    return items.find(i => i.fullPath === selectedPath) || null;
  }, [items, selectedPath, selectedItemState]);

  // Total size of selected items
  const selectedSize = useMemo(() => {
    return filteredItems
      .filter(i => selectedPaths.has(i.fullPath))
      .reduce((sum, item) => sum + (item.size || 0), 0);
  }, [filteredItems, selectedPaths]);

  // Set of paths that are currently cut (for dimming)
  const cutPaths = useMemo(() => {
    if (clipboard && clipboard.operation === 'move') {
      return new Set(clipboard.paths);
    }
    return new Set<string>();
  }, [clipboard]);

  // Tab Handlers
  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab && targetTab.path && targetTab.path !== currentPath) {
      navigate(targetTab.path);
    }
    if (targetTab?.viewMode) {
      setViewMode(targetTab.viewMode);
    }
  }, [tabs, currentPath, navigate]);

  const handleNewTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    const newTab: TabData = {
      id: newId,
      title: currentPath ? currentPath.split(/[\\/]/).filter(Boolean).pop() || 'Folder' : 'Home',
      path: currentPath || '',
      viewMode
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, [currentPath, viewMode]);

  const handleCloseTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    const index = tabs.findIndex(t => t.id === tabId);
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);

    if (activeTabId === tabId) {
      const nextTab = remaining[Math.max(0, index - 1)];
      setActiveTabId(nextTab.id);
      if (nextTab.path) navigate(nextTab.path);
    }
  }, [tabs, activeTabId, navigate]);

  // Multi-Selection Logic
  const handleSelectItem = useCallback((item: FsItem, e?: React.MouseEvent) => {
    setSelectedPath(item.fullPath);
    setSelectedItemState(item);

    if (e && (e.ctrlKey || e.metaKey)) {
      // Toggle selection
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(item.fullPath)) {
          next.delete(item.fullPath);
        } else {
          next.add(item.fullPath);
        }
        return next;
      });
      setLastSelectedPath(item.fullPath);
    } else if (e && e.shiftKey && lastSelectedPath) {
      // Shift range selection
      const idx1 = filteredItems.findIndex(i => i.fullPath === lastSelectedPath);
      const idx2 = filteredItems.findIndex(i => i.fullPath === item.fullPath);
      if (idx1 !== -1 && idx2 !== -1) {
        const [start, end] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        const rangePaths = new Set(selectedPaths);
        for (let i = start; i <= end; i++) {
          rangePaths.add(filteredItems[i].fullPath);
        }
        setSelectedPaths(rangePaths);
      } else {
        setSelectedPaths(new Set([item.fullPath]));
        setLastSelectedPath(item.fullPath);
      }
    } else {
      // Single selection
      setSelectedPaths(new Set([item.fullPath]));
      setLastSelectedPath(item.fullPath);
    }
  }, [filteredItems, lastSelectedPath, selectedPaths]);

  const handleClearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setSelectedPath(null);
    setSelectedItemState(null);
    setLastSelectedPath(null);
  }, []);

  const handleQuickLook = (item: FsItem) => {
    setSelectedPath(item.fullPath);
    setSelectedItemState(item);
    setIsQuickLookOpen(true);
  };

  const handleOpenProperties = useCallback((item?: FsItem | null) => {
    const target = item || selectedItem || (currentPath ? {
      name: currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath,
      isDir: true,
      size: 0,
      mtime: Date.now(),
      ext: '',
      fullPath: currentPath
    } as FsItem : null);

    if (target) {
      setPropertiesItem(target);
      setIsPropertiesOpen(true);
    }
  }, [selectedItem, currentPath]);

  // CRUD Operations
  const handleCreateFolder = useCallback(async () => {
    if (!currentPath) return;
    const res = await mediaService.createFolder(currentPath);
    if (res.ok && res.path) {
      await refresh();
      setSelectedPaths(new Set([res.path]));
      setSelectedPath(res.path);
      setRenamingPath(res.path);
    }
  }, [currentPath, refresh]);

  const handleCommitRename = useCallback(async (item: FsItem, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === item.name) {
      setRenamingPath(null);
      return;
    }
    const res = await mediaService.renameItem(item.fullPath, trimmed);
    if (res.ok && res.newPath) {
      await refresh();
      setSelectedPaths(new Set([res.newPath]));
      setSelectedPath(res.newPath);
      setRenamingPath(null);
    } else if (res.error) {
      alert(`Rename failed: ${res.error}`);
      setRenamingPath(null);
    }
  }, [refresh]);

  const handleCancelRename = useCallback(() => {
    setRenamingPath(null);
  }, []);

  const handleStartRename = useCallback(() => {
    if (selectedPaths.size === 1) {
      setRenamingPath(Array.from(selectedPaths)[0]);
    } else if (selectedPath) {
      setRenamingPath(selectedPath);
    }
  }, [selectedPaths, selectedPath]);

  const handleCopySelected = useCallback((singleItem?: FsItem) => {
    const targets = singleItem ? [singleItem.fullPath] : Array.from(selectedPaths);
    if (targets.length === 0 && selectedPath) targets.push(selectedPath);
    if (targets.length > 0) {
      setClipboard({ paths: targets, operation: 'copy' });
    }
  }, [selectedPaths, selectedPath]);

  const handleCutSelected = useCallback((singleItem?: FsItem) => {
    const targets = singleItem ? [singleItem.fullPath] : Array.from(selectedPaths);
    if (targets.length === 0 && selectedPath) targets.push(selectedPath);
    if (targets.length > 0) {
      setClipboard({ paths: targets, operation: 'move' });
    }
  }, [selectedPaths, selectedPath]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || clipboard.paths.length === 0 || !currentPath) return;
    const res = await mediaService.clipboardPaste(currentPath, clipboard.paths, clipboard.operation);
    if (res.ok) {
      if (clipboard.operation === 'move') {
        setClipboard(null);
      }
      await refresh();
    } else if (res.errors && res.errors.length > 0) {
      alert(`Paste failed: ${res.errors.join(', ')}`);
    }
  }, [clipboard, currentPath, refresh]);

  const handleDuplicateSelected = useCallback(async (singleItem?: FsItem) => {
    const targets = singleItem ? [singleItem.fullPath] : Array.from(selectedPaths);
    if (targets.length === 0 && selectedPath) targets.push(selectedPath);
    if (targets.length === 0) return;

    for (const p of targets) {
      await mediaService.duplicateItem(p);
    }
    await refresh();
  }, [selectedPaths, selectedPath, refresh]);

  const handleDeleteSelected = useCallback(async (singleItem?: FsItem, permanent = false) => {
    const targets = singleItem ? [singleItem.fullPath] : Array.from(selectedPaths);
    if (targets.length === 0 && selectedPath) targets.push(selectedPath);
    if (targets.length === 0) return;

    if (permanent) {
      const ok = window.confirm(`Permanently delete ${targets.length} item(s)? This action cannot be undone.`);
      if (!ok) return;
    }

    const res = await mediaService.deleteItems(targets, permanent);
    if (res.ok) {
      handleClearSelection();
      await refresh();
    } else if (res.errors && res.errors.length > 0) {
      alert(`Delete failed: ${res.errors.join(', ')}`);
    }
  }, [selectedPaths, selectedPath, handleClearSelection, refresh]);

  const handleSetTag = useCallback(async (filePath: string, color: string | null) => {
    const res = await mediaService.setFileTag(filePath, color);
    if (res.ok) {
      setColorTags(prev => {
        const next = { ...prev };
        if (color) next[filePath] = color;
        else delete next[filePath];
        return next;
      });
    }
  }, []);

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(180, Math.min(450, startW + (ev.clientX - startX)));
      setSidebarWidth(newW);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startInspectorResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = inspectorWidth;
    const onMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(240, Math.min(600, startW - (ev.clientX - startX)));
      setInspectorWidth(newW);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle external open target (CLI arg or Explorer double-click)
  const handleOpenTarget = useCallback(async (target: string) => {
    const isFile = isPhotoExtension((target.split('.').pop() || '').toLowerCase()) ||
                   isVideoExtension((target.split('.').pop() || '').toLowerCase());
    if (isFile) {
      const parentDir = target.substring(0, target.lastIndexOf('\\')) || target.substring(0, target.lastIndexOf('/'));
      if (parentDir) {
        await navigate(parentDir);
        const ext = (target.split('.').pop() || '').toLowerCase();
        const itemObj: FsItem = {
          name: target.split(/[\\/]/).pop() || '',
          isDir: false,
          size: 0,
          mtime: Date.now(),
          ext,
          fullPath: target
        };
        setSelectedPath(target);
        setSelectedPaths(new Set([target]));
        setActiveItem(itemObj);
      }
    } else {
      navigate(target);
    }
  }, [navigate]);

  useEffect(() => {
    mediaService.getInitialFile().then(target => {
      if (target) handleOpenTarget(target);
    });

    const unsubscribe = mediaService.onOpenTarget(target => {
      handleOpenTarget(target);
    });

    return () => unsubscribe();
  }, [handleOpenTarget]);

  // Global Keyboard Shortcuts (Native Mac Finder / Win Explorer)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Esc cancels rename or clears selection
      if (e.key === 'Escape') {
        if (renamingPath) {
          handleCancelRename();
          return;
        }
      }

      // If user is editing filename inline, do not intercept hotkeys
      if (isInput) return;

      // Spacebar -> macOS Quick Look
      if (e.code === 'Space') {
        e.preventDefault();
        if (selectedItem) {
          setIsQuickLookOpen(prev => !prev);
        }
      }

      // Ctrl / Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        // Tab shortcuts
        if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          handleNewTab();
          return;
        }
        if (e.key.toLowerCase() === 'w') {
          e.preventDefault();
          handleCloseTab(activeTabId);
          return;
        }

        // New folder (Ctrl+Shift+N)
        if (e.shiftKey && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleCreateFolder();
          return;
        }

        // View mode hotkeys (Ctrl+1 to 4)
        if (e.key === '1') {
          e.preventDefault();
          setViewMode('grid');
        } else if (e.key === '2') {
          e.preventDefault();
          setViewMode('table');
        } else if (e.key === '3') {
          e.preventDefault();
          setViewMode('columns');
        } else if (e.key === '4') {
          e.preventDefault();
          setViewMode('gallery');
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          setIsInspectorOpen(prev => !prev);
        } else if (e.key === ',') {
          e.preventDefault();
          setIsSettingsModalOpen(true);
        } else if (e.key.toLowerCase() === 'c') {
          // Copy
          e.preventDefault();
          handleCopySelected();
        } else if (e.key.toLowerCase() === 'x') {
          // Cut
          e.preventDefault();
          handleCutSelected();
        } else if (e.key.toLowerCase() === 'v') {
          // Paste
          e.preventDefault();
          handlePaste();
        } else if (e.key.toLowerCase() === 'd') {
          // Duplicate
          e.preventDefault();
          handleDuplicateSelected();
        } else if (e.key.toLowerCase() === 'a') {
          // Select All
          e.preventDefault();
          setSelectedPaths(new Set(filteredItems.map(i => i.fullPath)));
        }
      }

      // F2 -> Inline Rename
      if (e.key === 'F2') {
        e.preventDefault();
        handleStartRename();
      }

      // Delete -> Move to Recycle Bin (Delete) or Permanent (Shift+Delete)
      if (e.key === 'Delete') {
        e.preventDefault();
        handleDeleteSelected(undefined, e.shiftKey);
      }

      // Cmd/Ctrl+Shift+. -> Toggle Show Hidden Files
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '.' || e.key === '>')) {
        e.preventDefault();
        handleToggleShowHidden();
      }

      // Alt+Enter -> Open Full Properties Dialog
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        handleOpenProperties(selectedItem);
      }

      // Alt+Up -> Parent folder
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        goUp();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    selectedItem,
    selectedPaths,
    filteredItems,
    renamingPath,
    activeTabId,
    goUp,
    handleNewTab,
    handleCloseTab,
    handleCreateFolder,
    handleStartRename,
    handleCancelRename,
    handleCopySelected,
    handleCutSelected,
    handlePaste,
    handleDuplicateSelected,
    handleDeleteSelected,
    handleToggleShowHidden,
    handleOpenProperties
  ]);

  const handleChooseFolder = async () => {
    const folder = await mediaService.selectFolder();
    if (folder) navigate(folder);
  };

  const handleItemOpen = (item: FsItem) => {
    if (item.isDir) {
      navigate(item.fullPath);
    } else if (isVideoExtension(item.ext)) {
      mediaService.openSeparatePlayer(item.fullPath);
    } else if (isPhotoExtension(item.ext)) {
      setActiveItem(item);
    } else {
      mediaService.openExternal(item.fullPath);
    }
  };

  const handleOpenSeparately = (item: FsItem) => {
    mediaService.openSeparatePlayer(item.fullPath);
  };

  const handleContextMenu = (e: React.MouseEvent, item: FsItem | null) => {
    e.preventDefault();
    if (item && !selectedPaths.has(item.fullPath)) {
      setSelectedPaths(new Set([item.fullPath]));
      setSelectedPath(item.fullPath);
      setSelectedItemState(item);
    }
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const subfolders = useMemo(() => items.filter(i => i.isDir), [items]);

  return (
    <div className="flex flex-col h-screen mac-window select-none overflow-hidden transition-colors duration-200">
      {/* ── Top Multi-Tab Workspace Bar ── */}
      <ExplorerTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {/* Top Windows Explorer + Mac Finder Hybrid Command Toolbar */}
      <ExplorerToolbar
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        canGoUp={canGoUp}
        onGoBack={goBack}
        onGoForward={goForward}
        onGoUp={goUp}
        onRefresh={refresh}
        onGoHome={() => (quickAccess.length > 0 ? navigate(quickAccess[0].path) : drives.length > 0 && navigate(drives[0]))}
        currentPath={currentPath}
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={navigate}
        onNavigateDirectPath={navigate}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        sortField={sortField}
        sortOrder={sortOrder}
        onSetSort={handleSortToggle}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(prev => !prev)}
        onChooseFolder={handleChooseFolder}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        showHidden={showHidden}
        onToggleShowHidden={handleToggleShowHidden}
        density={density}
        onSetDensity={setDensity}
        // Pro CRUD Action Bar props
        onNewFolder={handleCreateFolder}
        onCut={() => handleCutSelected()}
        onCopy={() => handleCopySelected()}
        onPaste={handlePaste}
        onRename={handleStartRename}
        onDelete={() => handleDeleteSelected(undefined, false)}
        onDuplicate={() => handleDuplicateSelected()}
        selectedCount={selectedPaths.size}
        clipboardCount={clipboard ? clipboard.paths.length : 0}
        clipboardOp={clipboard?.operation || null}
      />

      {/* Main App Workspace with Resizable Dividers */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Mac Finder Sidebar */}
        <ExplorerSidebar
          quickAccess={quickAccess}
          drivesWithSpace={drivesWithSpace}
          currentPath={currentPath}
          filterCategory={filterCategory}
          onSetFilterCategory={setFilterCategory}
          onSelectPath={navigate}
          width={sidebarWidth}
          colorTags={colorTags}
          selectedTagColor={selectedTagColor}
          onSelectTagColor={setSelectedTagColor}
        />

        {/* Resizable Divider between Sidebar and Main Content */}
        <div
          onMouseDown={startSidebarResize}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 cursor-col-resize z-20 flex-shrink-0 transition-colors"
          title="Drag to resize sidebar"
        />

        {/* Content Area — Switchable between Grid, Table, Columns & Gallery */}
        <div
          onContextMenu={e => handleContextMenu(e, null)}
          className="flex-1 overflow-hidden flex flex-col mac-content min-w-0 transition-colors duration-200"
        >
          {!currentPath ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Film className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-base font-semibold">Select a location or drive to browse media</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading assets...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">No media files in this folder</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="flex-1 overflow-auto p-4">
              <ExplorerGrid
                items={filteredItems}
                selectedPath={selectedPath}
                selectedPaths={selectedPaths}
                cutPaths={cutPaths}
                renamingPath={renamingPath}
                colorTags={colorTags}
                density={density}
                onSelectItem={handleSelectItem}
                onOpenItem={handleItemOpen}
                onContextMenu={handleContextMenu}
                onCommitRename={handleCommitRename}
                onCancelRename={handleCancelRename}
                onClearSelection={handleClearSelection}
              />
            </div>
          ) : viewMode === 'table' ? (
            <div className="flex-1 overflow-auto p-4">
              <ExplorerTable
                items={filteredItems}
                selectedPath={selectedPath}
                selectedPaths={selectedPaths}
                cutPaths={cutPaths}
                renamingPath={renamingPath}
                colorTags={colorTags}
                onSelectItem={handleSelectItem}
                onOpenItem={handleItemOpen}
                onQuickLook={handleQuickLook}
                onContextMenu={handleContextMenu}
                onCommitRename={handleCommitRename}
                onCancelRename={handleCancelRename}
              />
            </div>
          ) : viewMode === 'columns' ? (
            <div className="flex-1 overflow-hidden">
              <ExplorerColumns
                currentPath={currentPath}
                initialItems={filteredItems}
                isInspectorOpen={isInspectorOpen}
                onSelectItem={handleSelectItem}
                onOpenItem={handleItemOpen}
                onQuickLook={handleQuickLook}
                onContextMenu={handleContextMenu}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <ExplorerGallery
                items={filteredItems}
                selectedItem={selectedItem}
                onSelectItem={handleSelectItem}
                onOpenViewer={setActiveItem}
                onContextMenu={handleContextMenu}
              />
            </div>
          )}
        </div>

        {/* Resizable Divider between Main Content and Inspector */}
        {isInspectorOpen && (
          <div
            onMouseDown={startInspectorResize}
            className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 cursor-col-resize z-20 flex-shrink-0 transition-colors"
            title="Drag to resize inspector panel"
          />
        )}

        {/* Collapsible Right Inspector / Details Pane */}
        {isInspectorOpen && (
          <ExplorerInspector
            item={selectedItem}
            currentPath={currentPath}
            width={inspectorWidth}
            onClose={() => setIsInspectorOpen(false)}
            onOpenViewer={setActiveItem}
            onQuickLook={handleQuickLook}
          />
        )}
      </div>

      {/* Bottom Status Bar */}
      <ExplorerStatusBar
        totalShown={filteredItems.length}
        allItems={items}
        selectedPath={selectedPath}
        selectedCount={selectedPaths.size}
        selectedSize={selectedSize}
      />

      {/* Windows / macOS Explorer Right-Click Context Menu */}
      <ExplorerContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onOpen={handleItemOpen}
        onOpenSeparately={handleOpenSeparately}
        onQuickLook={handleQuickLook}
        onShowInExplorer={p => mediaService.openInExplorer(p)}
        onCopyPath={p => navigator.clipboard.writeText(p)}
        onInspect={item => {
          handleSelectItem(item);
          handleOpenProperties(item);
        }}
        onOpenProperties={handleOpenProperties}
        onRefresh={refresh}
        onNewFolder={handleCreateFolder}
        onToggleHidden={handleToggleShowHidden}
        showHidden={showHidden}
        currentFolderItem={currentPath ? {
          name: currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath,
          isDir: true,
          size: 0,
          mtime: Date.now(),
          ext: '',
          fullPath: currentPath
        } : null}
        onCut={item => handleCutSelected(item)}
        onCopy={item => handleCopySelected(item)}
        onPaste={handlePaste}
        onDuplicate={item => handleDuplicateSelected(item)}
        onRename={item => setRenamingPath(item.fullPath)}
        onDelete={(item, permanent) => handleDeleteSelected(item, permanent)}
        onSetColorTag={handleSetTag}
        currentColorTag={contextMenu.item ? colorTags[contextMenu.item.fullPath] : null}
        canPaste={Boolean(clipboard && clipboard.paths.length > 0)}
      />

      {/* Full File / Folder Properties Modal */}
      <PropertiesModal
        item={propertiesItem}
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        onOpenPlayer={handleOpenSeparately}
      />

      {/* macOS Quick Look Spacebar Modal */}
      <QuickLookModal
        item={selectedItem}
        items={filteredItems}
        isOpen={isQuickLookOpen}
        onClose={() => setIsQuickLookOpen(false)}
        onOpenViewer={setActiveItem}
        onNavigate={handleSelectItem}
      />

      {/* Fullscreen HD Media Inspection Modal */}
      {activeItem && (
        <FullscreenViewer
          item={activeItem}
          items={filteredItems}
          onClose={() => setActiveItem(null)}
          onNavigate={target => {
            handleSelectItem(target);
            setActiveItem(target);
          }}
        />
      )}

      {/* Windows Default Apps Setup Modal */}
      <DefaultAppsModal
        isOpen={isDefaultAppsModalOpen}
        onClose={() => setIsDefaultAppsModalOpen(false)}
      />

      {/* macOS Preferences / Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        defaultViewMode={viewMode}
        onSetDefaultViewMode={setViewMode}
        onOpenDefaultAppsModal={() => setIsDefaultAppsModalOpen(true)}
        showHidden={showHidden}
        onToggleShowHidden={handleToggleShowHidden}
      />
    </div>
  );
}
