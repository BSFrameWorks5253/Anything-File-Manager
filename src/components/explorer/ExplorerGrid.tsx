import React, { useRef, useState } from 'react';
import { FsItem } from '../../types';
import { ThumbnailCard } from './ThumbnailCard';

interface ExplorerGridProps {
  items: FsItem[];
  selectedPath: string | null;
  selectedPaths?: Set<string>;
  cutPaths?: Set<string>;
  renamingPath?: string | null;
  colorTags?: Record<string, string>;
  density?: 'compact' | 'normal' | 'broad';
  onSelectItem: (item: FsItem, e?: React.MouseEvent) => void;
  onOpenItem: (item: FsItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: FsItem | null) => void;
  onCommitRename?: (item: FsItem, newName: string) => void;
  onCancelRename?: () => void;
  onClearSelection?: () => void;
}

export const ExplorerGrid: React.FC<ExplorerGridProps> = ({
  items,
  selectedPath,
  selectedPaths,
  cutPaths,
  renamingPath,
  colorTags = {},
  density = 'normal',
  onSelectItem,
  onOpenItem,
  onContextMenu,
  onCommitRename,
  onCancelRename,
  onClearSelection
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragBox, setDragBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const isDragging = useRef(false);

  const gridClass =
    density === 'compact'
      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 p-3 justify-items-center'
      : density === 'broad'
      ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6 justify-items-center'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4 justify-items-center';

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger marquee on direct background click with primary left button
    if (e.target !== containerRef.current || e.button !== 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const startY = e.clientY - rect.top + containerRef.current.scrollTop;

    isDragging.current = true;
    setDragBox({ x1: startX, y1: startY, x2: startX, y2: startY });
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      onClearSelection?.();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const currentY = e.clientY - rect.top + containerRef.current.scrollTop;

    setDragBox(prev => prev ? { ...prev, x2: currentX, y2: currentY } : null);
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      setDragBox(null);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={e => {
        if (e.target === containerRef.current) {
          e.preventDefault();
          onContextMenu?.(e, null);
        }
      }}
      className={`relative ${gridClass} min-h-full select-none`}
    >
      {/* Rubberband marquee selection box */}
      {dragBox && (
        <div
          style={{
            left: `${Math.min(dragBox.x1, dragBox.x2)}px`,
            top: `${Math.min(dragBox.y1, dragBox.y2)}px`,
            width: `${Math.abs(dragBox.x2 - dragBox.x1)}px`,
            height: `${Math.abs(dragBox.y2 - dragBox.y1)}px`
          }}
          className="absolute z-30 pointer-events-none bg-[var(--mac-accent)]/20 border border-[var(--mac-accent)] rounded"
        />
      )}

      {items.map(item => {
        const isSelected = selectedPaths ? selectedPaths.has(item.fullPath) : selectedPath === item.fullPath;
        const isCut = cutPaths ? cutPaths.has(item.fullPath) : false;
        const isRenaming = renamingPath === item.fullPath;
        const tag = colorTags[item.fullPath] || null;

        return (
          <ThumbnailCard
            key={item.fullPath}
            item={item}
            density={density}
            isSelected={isSelected}
            isCut={isCut}
            isRenaming={isRenaming}
            colorTag={tag}
            onClick={e => onSelectItem(item, e)}
            onOpen={() => onOpenItem(item)}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              onSelectItem(item, e);
              onContextMenu?.(e, item);
            }}
            onCommitRename={newName => onCommitRename?.(item, newName)}
            onCancelRename={onCancelRename}
          />
        );
      })}
    </div>
  );
};
