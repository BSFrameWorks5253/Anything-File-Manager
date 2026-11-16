import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatTimelapse } from '../../utils';

interface AudioWaveformBarProps {
  currentTime: number;
  duration: number;
  onSeek: (targetTime: number) => void;
  className?: string;
  seedPath?: string;
}

export const AudioWaveformBar: React.FC<AudioWaveformBarProps> = ({
  currentTime,
  duration,
  onSeek,
  className = '',
  seedPath = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Generate consistent audio peak silhouette for this media item
  const barCount = 72;
  const waveformBars = useMemo(() => {
    // Generate organic speech/music dynamic audio wave envelope
    let hash = 0;
    const str = seedPath || 'media_waveform_seed';
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const r = pseudoRandom(hash + i * 13);
      // Realistic dialogue / musical peak envelope with quiet pauses & louder bursts
      const burst = Math.sin((i / barCount) * Math.PI * 4) * 0.25;
      const height = Math.min(1, Math.max(0.12, r * 0.75 + burst + 0.15));
      bars.push(height);
    }
    return bars;
  }, [seedPath]);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleSeekEvent(e.clientX);
  };

  const handleSeekEvent = (clientX: number) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const targetTime = (clampedX / rect.width) * duration;
    onSeek(targetTime);
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        handleSeekEvent(e.clientX);
      }
    };
    const onPointerUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, duration]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setHoverX(x);
    setHoverTime((x / rect.width) * duration);
    setIsHovering(true);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setHoverTime(null);
      }}
      onPointerDown={handlePointerDown}
      className={`relative h-9 flex items-center cursor-pointer select-none group px-1 ${className}`}
      title="Click or drag to scrub video & audio"
    >
      {/* Background track */}
      <div className="absolute inset-0 flex items-center justify-between gap-[2px] opacity-75">
        {waveformBars.map((bar, idx) => {
          const barPercent = (idx / barCount) * 100;
          const isPassed = barPercent <= progressPercent;
          return (
            <div
              key={idx}
              style={{ height: `${bar * 100}%` }}
              className={`flex-1 rounded-full transition-colors duration-75 ${
                isPassed
                  ? 'bg-gradient-to-t from-sky-500 to-indigo-400 opacity-95 shadow-sm'
                  : 'bg-white/20 group-hover:bg-white/30'
              }`}
            />
          );
        })}
      </div>

      {/* Scrubber Playhead Line */}
      <div
        style={{ left: `${progressPercent}%` }}
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white -ml-1 -top-1 absolute shadow-md ring-2 ring-indigo-500" />
      </div>

      {/* Hover Scrub Line & Timecode Tooltip */}
      {isHovering && hoverTime !== null && (
        <div
          style={{ left: `${hoverX}px` }}
          className="absolute top-0 bottom-0 w-[1px] bg-sky-300 pointer-events-none z-20"
        >
          <div className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 text-[10px] font-mono font-bold text-white shadow-lg border border-white/20 whitespace-nowrap">
            {formatTimelapse(hoverTime)}
          </div>
        </div>
      )}
    </div>
  );
};
