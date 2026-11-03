import React from 'react';

interface ImageViewerProps {
  src: string;
  name: string;
  zoom: number;
  pan: { x: number; y: number };
  rotate: number;
  isDragging: boolean;
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  name,
  zoom,
  pan,
  rotate,
  isDragging,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp
}) => {
  return (
    <div
      className="flex-1 relative flex items-center justify-center overflow-hidden w-full h-full"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <img
        src={src}
        alt={name}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'transform 0.12s ease-out'
        }}
        className="max-h-[85vh] max-w-[90vw] object-contain select-none shadow-2xl rounded"
        draggable={false}
      />
    </div>
  );
};
