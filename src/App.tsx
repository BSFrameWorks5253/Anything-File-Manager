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
  ExplorerStatusBar
} from './components/explorer';
import { FullscreenViewer } from './components/viewer';
import { DefaultAppsModal, SettingsModal } from './components/modals';

export default function App() {
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

  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedItemState, setSelectedItemState] = useState<FsItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isQuickLookOpen, setIsQuickLookOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<FsItem | null>(null);
  const [isDefaultAppsModalOpen, setIsDefaultAppsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
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

  // Selected item object (reliable across folders and columns)
  const selectedItem = useMemo(() => {
    if (selectedItemState && selectedItemState.fullPath === selectedPath) {
      return selectedItemState;
    }
    return items.find(i => i.fullPath === selectedPath) || null;
  }, [items, selectedPath, selectedItemState]);

  const handleSelectItem = (item: FsItem) => {
    setSelectedPath(item.fullPath);
    setSelectedItemState(item);
  };

  const handleQuickLook = (item: FsItem) => {
    setSelectedPath(item.fullPath);
    setSelectedItemState(item);
    setIsQuickLookOpen(true);
  };

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

  // Handle external open target (from CLI argument or Windows Explorer double click)
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

  // Spacebar for macOS Quick Look & Hotkeys for view switching
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Spacebar -> Toggle macOS Quick Look
      if (e.code === 'Space') {
        e.preventDefault();
        if (selectedItem) {
          setIsQuickLookOpen(prev => !prev);
        }
      }

      // View mode hotkeys (Ctrl+1 to 4)
      if (e.ctrlKey || e.metaKey) {
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
        }
      }

      // Cmd/Ctrl+Shift+. -> Toggle Show Hidden Files (Native macOS Finder / Explorer shortcut)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '.' || e.key === '>')) {
        e.preventDefault();
        handleToggleShowHidden();
      }

      // Alt+Up -> Parent folder
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        goUp();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedItem, goUp]);

  const handleChooseFolder = async () => {
    const folder = await mediaService.selectFolder();
    if (folder) navigate(folder);
  };

  const handleItemOpen = (item: FsItem) => {
    if (item.isDir) {
      navigate(item.fullPath);
    } else if (isPhotoExtension(item.ext) || isVideoExtension(item.ext)) {
      setActiveItem(item);
    } else {
      mediaService.openExternal(item.fullPath);
    }
  };

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

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
  }, [items, search, filterCategory, sortField, sortOrder]);

  const subfolders = useMemo(() => items.filter(i => i.isDir), [items]);

  return (
    <div className="flex flex-col h-screen mac-window select-none overflow-hidden transition-colors duration-200">
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
      />

      {/* Main App Workspace with Resizable Dividers */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Mac/Win Hybrid Sidebar */}
        <ExplorerSidebar
          quickAccess={quickAccess}
          drivesWithSpace={drivesWithSpace}
          currentPath={currentPath}
          subfolders={subfolders}
          filterCategory={filterCategory}
          onSetFilterCategory={setFilterCategory}
          onSelectPath={navigate}
          width={sidebarWidth}
        />

        {/* Resizable Divider between Sidebar and Main Content */}
        <div
          onMouseDown={startSidebarResize}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-500/50 active:bg-indigo-500 cursor-col-resize z-20 flex-shrink-0 transition-colors"
          title="Drag to resize sidebar"
        />

        {/* Content Area — Switchable between Grid, Table, Columns & Gallery */}
        <div className="flex-1 overflow-hidden flex flex-col mac-content min-w-0 transition-colors duration-200">
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
                onSelectItem={handleSelectItem}
                onOpenItem={handleItemOpen}
              />
            </div>
          ) : viewMode === 'table' ? (
            <div className="flex-1 overflow-auto p-4">
              <ExplorerTable
                items={filteredItems}
                selectedPath={selectedPath}
                onSelectItem={handleSelectItem}
                onOpenItem={handleItemOpen}
                onQuickLook={handleQuickLook}
              />
            </div>
          ) : viewMode === 'columns' ? (
            <div className="flex-1 overflow-hidden">
              <ExplorerColumns
                currentPath={currentPath}
                initialItems={filteredItems}
                onSelectItem={handleSelectItem}
                onOpenItem={handleItemOpen}
                onQuickLook={handleQuickLook}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <ExplorerGallery
                items={filteredItems}
                selectedItem={selectedItem}
                onSelectItem={handleSelectItem}
                onOpenViewer={setActiveItem}
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
            setSelectedPath(target.fullPath);
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
