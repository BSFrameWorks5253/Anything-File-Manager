import React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { formatTimelapse } from '../../utils';

interface VideoControlsBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onStepFrame: (frames: number) => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export const VideoControlsBar: React.FC<VideoControlsBarProps> = ({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  onStepFrame,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  playbackSpeed,
  onSpeedChange
}) => {
  return (
    <div
      className="px-6 py-3 bg-[#11131c]/95 border-t border-white/10 flex items-center gap-4"
      onClick={e => e.stopPropagation()}
    >
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-transform active:scale-95"
        title="Play / Pause (Space)"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Time indicator */}
      <span className="text-xs font-mono text-gray-300 w-28">
        {formatTimelapse(currentTime)} / {formatTimelapse(duration)}
      </span>

      {/* Frame-by-frame Stepping Buttons */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
        <button
          onClick={() => onStepFrame(-1)}
          className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded font-semibold"
          title="Step -1 Frame Back (Left arrow)"
        >
          ⏮ -1f
        </button>
        <button
          onClick={() => onStepFrame(1)}
          className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded font-semibold"
          title="Step +1 Frame Forward (Right arrow)"
        >
          +1f ⏭
        </button>
      </div>

      {/* Seek Track */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={currentTime}
        onChange={e => onSeek(parseFloat(e.target.value))}
        className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-white/20 rounded-lg"
      />

      {/* Volume */}
      <button
        onClick={onToggleMute}
        className="p-2 hover:bg-white/10 rounded-lg text-gray-300"
        title="Toggle Mute"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={isMuted ? 0 : volume}
        onChange={e => onVolumeChange(parseFloat(e.target.value))}
        className="w-20 accent-indigo-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
      />

      {/* Speed Select */}
      <select
        value={playbackSpeed}
        onChange={e => onSpeedChange(parseFloat(e.target.value))}
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
      >
        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
          <option key={s} value={s} className="bg-[#141620]">
            {s}×
          </option>
        ))}
      </select>

      {/* Duration Badge */}
      <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
        ⏱ {formatTimelapse(duration)}
      </span>
    </div>
  );
};
