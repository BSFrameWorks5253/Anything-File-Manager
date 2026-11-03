import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Film, RefreshCw } from 'lucide-react';
import { FsItem, FilterCategory, ViewMode } from './types';
import { isPhotoExtension, isVideoExtension } from './utils';
import { mediaService, thumbnailService } from './services';
import { useMediaNavigation } from './hooks';
import {
  ExplorerSidebar,
  ExplorerToolbar,
  ExplorerGrid,
  ExplorerTable,
  ExplorerStatusBar
} from './components/explorer';
import { FullscreenViewer } from './components/viewer';
import { DefaultAppsModal } from './components/modals';

export default function App() {
  const {
    drives,
    currentPath,
    items,
    loading,
    navigate,
    refresh,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    breadcrumbs
  } = useMediaNavigation();

  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeItem, setActiveItem] = useState<FsItem | null>(null);
  const [isDefaultAppsModalOpen, setIsDefaultAppsModalOpen] = useState(false);

  // Handle external open target (from CLI argument or Windows Explorer double click)
  const handleOpenTarget = useCallback(async (target: string) => {
    const isFile = isPhotoExtension((target.split('.').pop() || '').toLowerCase()) ||
                   isVideoExtension((target.split('.').pop() || '').toLowerCase());
    if (isFile) {
      const parentDir = target.substring(0, target.lastIndexOf('\\')) || target.substring(0, target.lastIndexOf('/'));
      if (parentDir) {
        await navigate(parentDir);
        const ext = (target.split('.').pop() || '').toLowerCase();
        setActiveItem({
          name: target.split(/[\\/]/).pop() || '',
          isDir: false,
          size: 0,
          mtime: Date.now(),
          ext,
          fullPath: target
        });
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

  // Filter items by category & search term
  const filteredItems = useMemo(() => {
    let list = items;
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
    return list;
  }, [items, search, filterCategory]);

  const subfolders = useMemo(() => items.filter(i => i.isDir), [items]);

  return (
    <div className="flex flex-col h-screen bg-[#0c0d12] text-gray-200 select-none">
      {/* Top Studio Toolbar */}
      <ExplorerToolbar
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={goBack}
        onGoForward={goForward}
        onRefresh={refresh}
        onGoHome={() => drives.length > 0 && navigate(drives[0])}
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={navigate}
        filterCategory={filterCategory}
        onSetFilterCategory={setFilterCategory}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onChooseFolder={handleChooseFolder}
        onOpenDefaultAppsModal={() => setIsDefaultAppsModalOpen(true)}
      />

      {/* Main Studio Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left Drives & Subfolders Sidebar */}
        <ExplorerSidebar
          drives={drives}
          currentPath={currentPath}
          subfolders={subfolders}
          onSelectDrive={navigate}
          onSelectFolder={navigate}
        />

        {/* Media Asset Content Area */}
        <div className="flex-1 overflow-auto p-4">
          {!currentPath ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Film className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-base font-semibold">Select a drive or open a folder to browse media</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading media assets...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">No media files match your search / filter in this folder.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <ExplorerGrid
              items={filteredItems}
              selectedPath={selectedPath}
              onSelectItem={item => setSelectedPath(item.fullPath)}
              onOpenItem={handleItemOpen}
            />
          ) : (
            <ExplorerTable
              items={filteredItems}
              selectedPath={selectedPath}
              onSelectItem={item => setSelectedPath(item.fullPath)}
              onOpenItem={handleItemOpen}
            />
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <ExplorerStatusBar
        totalShown={filteredItems.length}
        allItems={items}
        selectedPath={selectedPath}
      />

      {/* Fullscreen HD Media Viewer Modal */}
      {activeItem && (
        <FullscreenViewer
          item={activeItem}
          items={filteredItems}
          onClose={() => setActiveItem(null)}
          onNavigate={target => setActiveItem(target)}
        />
      )}

      {/* Windows Explorer & Default Viewer Settings Modal */}
      <DefaultAppsModal
        isOpen={isDefaultAppsModalOpen}
        onClose={() => setIsDefaultAppsModalOpen(false)}
      />
    </div>
  );
}
