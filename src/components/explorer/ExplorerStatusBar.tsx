import React from 'react';
import { FsItem } from '../../types';
import { isVideoExtension, isPhotoExtension } from '../../utils';

interface ExplorerStatusBarProps {
  totalShown: number;
  allItems: FsItem[];
  selectedPath: string | null;
}

export const ExplorerStatusBar: React.FC<ExplorerStatusBarProps> = ({
  totalShown,
  allItems,
  selectedPath
}) => {
  const videoCount = allItems.filter(i => isVideoExtension(i.ext)).length;
  const photoCount = allItems.filter(i => isPhotoExtension(i.ext)).length;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--mac-border)] mac-header text-xs text-[var(--mac-text-muted)] transition-colors duration-200">
      <div className="flex items-center gap-4">
        <span>{totalShown} items shown</span>
        <span>{videoCount} videos</span>
        <span>{photoCount} photos</span>
      </div>
      {selectedPath && (
        <span className="truncate max-w-xl text-[var(--mac-text-secondary)] font-mono text-[11px]">
          {selectedPath}
        </span>
      )}
    </div>
  );
};
