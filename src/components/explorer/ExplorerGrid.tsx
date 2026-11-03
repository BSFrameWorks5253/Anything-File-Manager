import React from 'react';
import { FsItem } from '../../types';
import { ThumbnailCard } from './ThumbnailCard';

interface ExplorerGridProps {
  items: FsItem[];
  selectedPath: string | null;
  onSelectItem: (item: FsItem) => void;
  onOpenItem: (item: FsItem) => void;
}

export const ExplorerGrid: React.FC<ExplorerGridProps> = ({
  items,
  selectedPath,
  onSelectItem,
  onOpenItem
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4">
      {items.map(item => (
        <ThumbnailCard
          key={item.fullPath}
          item={item}
          isSelected={selectedPath === item.fullPath}
          onClick={() => onSelectItem(item)}
          onOpen={() => onOpenItem(item)}
        />
      ))}
    </div>
  );
};
