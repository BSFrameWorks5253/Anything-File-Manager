import React from 'react';

interface VideoPlayerProps {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  isLoop?: boolean;
  onTimeUpdate: () => void;
  onDurationChange: () => void;
  onPlay: () => void;
  onPause: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  videoRef,
  zoom,
  pan,
  isDragging,
  isLoop = false,
  onTimeUpdate,
  onDurationChange,
  onPlay,
  onPause,
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
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop={isLoop}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'transform 0.12s ease-out'
        }}
        className="max-h-[84vh] max-w-[90vw] object-contain select-none shadow-2xl rounded-xl"
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onPlay={onPlay}
        onPause={onPause}
      />
    </div>
  );
};
