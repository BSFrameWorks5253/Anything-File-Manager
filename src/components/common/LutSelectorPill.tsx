import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, ChevronDown, Sparkles } from 'lucide-react';
import { LUT_PRESETS, LutPreset } from '../../utils/lutFilters';

interface LutSelectorPillProps {
  currentLut: string;
  onSelectLut: (lutId: string) => void;
  className?: string;
}

export const LutSelectorPill: React.FC<LutSelectorPillProps> = ({
  currentLut,
  onSelectLut,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activePreset = LUT_PRESETS.find(p => p.id === currentLut) || LUT_PRESETS[0];
  const isEnabled = activePreset.id !== 'off';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      {/* 1-Click Toggle / Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all shadow-sm ${
          isEnabled
            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/20'
            : 'bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white border border-white/10'
        }`}
        title="Live Camera LOG to Rec.709 Preview LUT"
      >
        <Sparkles className={`w-3.5 h-3.5 ${isEnabled ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}`} />
        <span className="font-semibold">LUT:</span>
        <span className={isEnabled ? 'font-bold text-amber-200' : 'text-neutral-300'}>
          {activePreset.shortLabel}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Preset Menu Overlay */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-2xl bg-neutral-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-1.5 flex flex-col gap-1 text-left"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Camera LOG to Rec.709 LUT
            </span>
            {isEnabled && (
              <button
                onClick={() => {
                  onSelectLut('off');
                  setIsOpen(false);
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline"
              >
                Reset (Off)
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            {LUT_PRESETS.map(preset => {
              const isSelected = preset.id === currentLut;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectLut(preset.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-200 font-semibold'
                      : 'hover:bg-white/10 text-neutral-300 hover:text-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{preset.name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {preset.camera}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
