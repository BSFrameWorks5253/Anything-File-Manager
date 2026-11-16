import React, { useEffect, useState } from 'react';
import { FastForward, Rewind, Play, Pause, StepBack, StepForward } from 'lucide-react';

interface NleShuttleBadgeProps {
  shuttleSpeed: number; // e.g. -4, -2, -1, 0, 1, 2, 4, 8
  isFrameStep?: -1 | 1 | null;
  triggerKey: number; // increments on each change
}

export const NleShuttleBadge: React.FC<NleShuttleBadgeProps> = ({
  shuttleSpeed,
  isFrameStep,
  triggerKey
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (triggerKey === 0) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [triggerKey]);

  if (!visible) return null;

  let text = '1x';
  let icon = <Play className="w-5 h-5 fill-white text-white" />;

  if (isFrameStep === -1) {
    text = '-1 Frame';
    icon = <StepBack className="w-5 h-5 text-sky-400" />;
  } else if (isFrameStep === 1) {
    text = '+1 Frame';
    icon = <StepForward className="w-5 h-5 text-sky-400" />;
  } else if (shuttleSpeed === 0) {
    text = 'PAUSE';
    icon = <Pause className="w-5 h-5 fill-white text-white" />;
  } else if (shuttleSpeed > 1) {
    text = `${shuttleSpeed}x Forward`;
    icon = <FastForward className="w-5 h-5 fill-sky-400 text-sky-400" />;
  } else if (shuttleSpeed < 0) {
    text = `${Math.abs(shuttleSpeed)}x Reverse`;
    icon = <Rewind className="w-5 h-5 fill-amber-400 text-amber-400" />;
  } else {
    text = '1x Play';
    icon = <Play className="w-5 h-5 fill-white text-white" />;
  }

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/20 text-white shadow-2xl">
        {icon}
        <span className="font-mono font-bold text-sm tracking-wide">{text}</span>
      </div>
    </div>
  );
};
