import React from 'react';
import { X, Plus } from 'lucide-react';
import { MacFolderIcon } from '../common/MacIcons';

export interface TabData {
  id: string;
  title: string;
  path: string;
  viewMode?: 'grid' | 'table' | 'columns' | 'gallery';
}

interface ExplorerTabBarProps {
  tabs: TabData[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

export const ExplorerTabBar: React.FC<ExplorerTabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab
}) => {
  return (
    <div className="flex items-center px-3 pt-1.5 bg-[#e8e8ed] dark:bg-[#1a1b22] border-b border-black/10 dark:border-white/10 select-none overflow-x-auto no-scrollbar gap-1.5 flex-shrink-0 transition-colors">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const displayTitle = tab.title || (tab.path ? tab.path.split(/[\\/]/).filter(Boolean).pop() || tab.path : 'This PC');

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs cursor-pointer transition-all max-w-[200px] min-w-[110px] truncate border-t border-x ${
                isActive
                  ? 'bg-white dark:bg-[#282a36] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border-black/15 dark:border-white/15'
                  : 'bg-black/[0.04] dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-neutral-100 border-transparent'
              }`}
              title={tab.path || 'This PC'}
            >
              <MacFolderIcon size={14} className="flex-shrink-0" />
              <span className="truncate flex-1 text-[11.5px]">{displayTitle}</span>

              {tabs.length > 1 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/15 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Close Tab (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus / New Tab button */}
        <button
          onClick={onNewTab}
          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors ml-1"
          title="New Tab (Ctrl+T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
