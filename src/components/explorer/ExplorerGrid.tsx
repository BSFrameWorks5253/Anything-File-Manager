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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
      {items.map(item => (
        <ThumbnailCard
          key={item.fullPath}
          item={item}
          onClick={() => onSelectItem(item)}
          onOpen={() => onOpenItem(item)}
        />
      ))}
    </div>
  );
};
