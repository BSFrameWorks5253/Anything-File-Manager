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
    <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-[#12141c] text-xs text-gray-500">
      <div className="flex items-center gap-4">
        <span>{totalShown} items shown</span>
        <span>{videoCount} videos</span>
        <span>{photoCount} photos</span>
      </div>
      {selectedPath && (
        <span className="truncate max-w-xl text-gray-400 font-mono text-[11px]">
          {selectedPath}
        </span>
      )}
    </div>
  );
};
