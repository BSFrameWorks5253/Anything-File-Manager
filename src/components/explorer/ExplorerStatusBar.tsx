import React from 'react';
import { FsItem } from '../../types';
import { isVideoExtension, isPhotoExtension, formatBytes } from '../../utils';

interface ExplorerStatusBarProps {
  totalShown: number;
  allItems: FsItem[];
  selectedPath: string | null;
  selectedCount?: number;
  selectedSize?: number;
}

export const ExplorerStatusBar: React.FC<ExplorerStatusBarProps> = ({
  totalShown,
  allItems,
  selectedPath,
  selectedCount = 0,
  selectedSize = 0
}) => {
  const videoCount = allItems.filter(i => isVideoExtension(i.ext)).length;
  const photoCount = allItems.filter(i => isPhotoExtension(i.ext)).length;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--mac-border)] mac-header text-[11px] text-[var(--mac-text-muted)] select-none transition-colors duration-200">
      <div className="flex items-center gap-3">
        <span className="font-medium text-[var(--mac-text-secondary)]">{totalShown} items</span>
        {videoCount > 0 && <span>{videoCount} videos</span>}
        {photoCount > 0 && <span>{photoCount} photos</span>}
        {selectedCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-[var(--mac-accent)]/15 text-[var(--mac-accent)] font-semibold">
            {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
            {selectedSize > 0 ? ` (${formatBytes(selectedSize)})` : ''}
          </span>
        )}
      </div>
      {selectedPath && (
        <span className="truncate max-w-xl text-[var(--mac-text-muted)] font-mono text-[10.5px]">
          {selectedPath}
        </span>
      )}
    </div>
  );
};
