import React from 'react';
import { FsItem } from '../../types';
import { ThumbnailCard } from './ThumbnailCard';

interface ExplorerGridProps {
  items: FsItem[];
  selectedPath: string | null;
  density?: 'compact' | 'normal' | 'broad';
  onSelectItem: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: FsItem | null) => void;
}

export const ExplorerGrid: React.FC<ExplorerGridProps> = ({
  items,
  selectedPath,
  density = 'normal',
  onSelectItem,
  onOpenItem,
  onContextMenu
}) => {
  const gridClass =
    density === 'compact'
      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 p-3'
      : density === 'broad'
      ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4';

  return (
    <div
      onContextMenu={e => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onContextMenu?.(e, null);
        }
      }}
      className={`${gridClass} min-h-full`}
    >
      {items.map(item => (
        <ThumbnailCard
          key={item.fullPath}
          item={item}
          density={density}
          isSelected={selectedPath === item.fullPath}
          onClick={() => onSelectItem(item)}
          onOpen={() => onOpenItem(item)}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            onSelectItem(item);
            onContextMenu?.(e, item);
          }}
        />
      ))}
    </div>
  );
};
