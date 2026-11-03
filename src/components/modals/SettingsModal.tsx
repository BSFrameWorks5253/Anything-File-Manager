import React, { useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Laptop,
  Check,
  Palette,
  Sliders,
  ShieldCheck,
  Trash2,
  HardDrive,
  Eye,
  LayoutGrid,
  List,
  Columns,
  SquareCode
} from 'lucide-react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { ViewMode, SortField } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultViewMode: ViewMode;
  onSetDefaultViewMode: (mode: ViewMode) => void;
  onOpenDefaultAppsModal?: () => void;
}

const ACCENT_COLORS = [
  { name: 'macOS Blue', color: '#0071e3' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Graphite', color: '#64748b' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultViewMode,
  onSetDefaultViewMode,
  onOpenDefaultAppsModal
}) => {
  const { theme, actualTheme, setTheme, accentColor, setAccentColor } = useTheme();
  const [activeTab, setActiveTab] = useState<'appearance' | 'general' | 'cache'>('appearance');
  const [cacheCleared, setCacheCleared] = useState(false);

  if (!isOpen) return null;

  const handleClearCache = () => {
    try {
      localStorage.removeItem('media-viewer-thumbs');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2500);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl mac-card border mac-border shadow-2xl flex flex-col overflow-hidden transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* macOS Preferences Titlebar */}
        <div className="flex items-center justify-between px-4 py-3 border-b mac-border mac-header">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer hover:opacity-80"
              onClick={onClose}
              title="Close (Esc)"
            />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
            <span className="text-xs font-semibold mac-text-primary ml-2">Preferences</span>
          </div>

          {/* Segmented Tab Controls */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg mac-header border mac-border">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'appearance'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'mac-text-secondary hover:mac-text-primary'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Appearance</span>
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'mac-text-secondary hover:mac-text-primary'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>General</span>
            </button>
            <button
              onClick={() => setActiveTab('cache')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTab === 'cache'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'mac-text-secondary hover:mac-text-primary'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Cache</span>
            </button>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 mac-text-secondary hover:mac-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 mac-content space-y-6 min-h-[340px]">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Selector with Visual Preview Cards */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mac-text-secondary block mb-3">
                  Theme Appearance
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Light Mode Card */}
                  <div
                    onClick={() => setTheme('light')}
                    className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/10'
                        : 'mac-border hover:border-gray-400/50'
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-[#ffffff] border border-gray-200 shadow-sm flex flex-col overflow-hidden p-1.5">
                      <div className="flex items-center gap-1 pb-1 border-b border-gray-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                      </div>
                      <div className="flex-1 flex gap-1 pt-1">
                        <div className="w-1/3 bg-[#ececf1] rounded" />
                        <div className="flex-1 bg-[#f5f6fa] rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium mac-text-primary">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Light</span>
                      {theme === 'light' && <Check className="w-3.5 h-3.5 text-blue-500 ml-0.5" />}
                    </div>
                  </div>

                  {/* Dark Mode Card */}
                  <div
                    onClick={() => setTheme('dark')}
                    className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10'
                        : 'mac-border hover:border-gray-500/50'
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-[#141620] border border-white/10 shadow-sm flex flex-col overflow-hidden p-1.5">
                      <div className="flex items-center gap-1 pb-1 border-b border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                      </div>
                      <div className="flex-1 flex gap-1 pt-1">
                        <div className="w-1/3 bg-[#1e202c] rounded" />
                        <div className="flex-1 bg-[#0e1017] rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium mac-text-primary">
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Dark</span>
                      {theme === 'dark' && <Check className="w-3.5 h-3.5 text-blue-500 ml-0.5" />}
                    </div>
                  </div>

                  {/* Auto / System Mode Card */}
                  <div
                    onClick={() => setTheme('auto')}
                    className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                      theme === 'auto'
                        ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10'
                        : 'mac-border hover:border-gray-500/50'
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg border border-gray-400/20 shadow-sm flex overflow-hidden">
                      <div className="w-1/2 bg-[#ffffff] p-1 flex flex-col">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56] mb-1" />
                        <div className="flex-1 bg-[#ececf1] rounded" />
                      </div>
                      <div className="w-1/2 bg-[#141620] p-1 flex flex-col">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f] self-end mb-1" />
                        <div className="flex-1 bg-[#0e1017] rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium mac-text-primary">
                      <Laptop className="w-3.5 h-3.5 text-sky-500" />
                      <span>Auto</span>
                      {theme === 'auto' && <Check className="w-3.5 h-3.5 text-blue-500 ml-0.5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accent Color Palette */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mac-text-secondary block mb-3">
                  macOS Accent Color
                </label>
                <div className="flex items-center gap-3">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.color}
                      onClick={() => setAccentColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        accentColor === c.color ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      title={c.name}
                    >
                      {accentColor === c.color && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Default View Mode */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mac-text-secondary block mb-3">
                  Default Folder View
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'grid', label: 'Icons / Grid', icon: LayoutGrid },
                    { id: 'table', label: 'List / Details', icon: List },
                    { id: 'columns', label: 'Miller Columns', icon: Columns },
                    { id: 'gallery', label: 'Gallery', icon: SquareCode }
                  ].map(v => {
                    const Icon = v.icon;
                    const isSelected = defaultViewMode === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => onSetDefaultViewMode(v.id as ViewMode)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10 mac-text-primary ring-1 ring-blue-500/30'
                            : 'mac-border mac-text-secondary hover:mac-text-primary hover:border-gray-400/40'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-blue-500" />
                        <span>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Windows Default Apps Integration */}
              {onOpenDefaultAppsModal && (
                <div className="p-4 rounded-xl border mac-border mac-header flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold mac-text-primary block">
                      Windows System Media Integration
                    </span>
                    <span className="text-[11px] mac-text-secondary block mt-0.5">
                      Set as Windows default viewer for Photos, Videos, and Camera RAW
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDefaultAppsModal();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Configure</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cache' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border mac-border mac-header">
                <span className="text-xs font-bold mac-text-primary block">
                  Disk Thumbnail Cache
                </span>
                <span className="text-xs mac-text-secondary block mt-1">
                  Cached thumbnails for camera RAW photos, video frame snapshots, audio cover art, and PDFs are persistently stored to ensure instantaneous folder browsing.
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleClearCache}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Memory Cache</span>
                  </button>
                  {cacheCleared && (
                    <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Cleared!
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t mac-border mac-header flex items-center justify-between text-xs mac-text-secondary">
          <span>Preferences are saved automatically</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
