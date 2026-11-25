import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Film,
  Volume2,
  VolumeX,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Maximize2,
  RotateCcw,
  Sliders,
  Scissors
} from 'lucide-react';
import { FsItem } from '../../types';
import { adobeService, mediaService } from '../../services';
import {
  PremiereProjectParseResult,
  PremiereClipItem,
  PremiereTrack,
  PremiereAssetItem
} from '../../../electron/ipc/adobe.ipc';
import { formatTimelapse, formatBytes } from '../../utils';

interface PremiereProjectQuickLookProps {
  item: FsItem;
}

// Adobe Premiere signature timeline clip colors
const PREMIERE_CLIP_COLORS = [
  '#4353A3', // Iris
  '#6C4F9E', // Violet
  '#1E6F74', // Caribbean
  '#1E5E94', // Cerulean
  '#2E6B43', // Forest
  '#943E5E', // Rose
  '#9E681C', // Mango
  '#596375'  // Steel
];

function getClipColor(name: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const idx = Math.abs(hash + index) % PREMIERE_CLIP_COLORS.length;
  return PREMIERE_CLIP_COLORS[idx];
}

function formatTimecode(seconds: number, fps = 30): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export const PremiereProjectQuickLook: React.FC<PremiereProjectQuickLookProps> = ({ item }) => {
  const [project, setProject] = useState<PremiereProjectParseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeqIndex, setSelectedSeqIndex] = useState(0);

  // Playhead & Transport
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [timelineZoom, setTimelineZoom] = useState(1); // 1 = fit, 2 = 2x zoom, 4 = 4x zoom
  const [activeTab, setActiveTab] = useState<'timeline' | 'assets'>('timeline');

  // Video element in Program Monitor
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const playheadRafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setPlayheadSec(0);
    setIsPlaying(false);

    adobeService.parsePrproj(item.fullPath).then(res => {
      if (isCurrent) {
        setProject(res);
        setLoading(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [item.fullPath]);

  const activeSequence = project?.sequences?.[selectedSeqIndex] || null;
  const seqDurationSec = Math.max(1, activeSequence?.durationSec || 10);
  const fps = activeSequence?.timebase || 30;

  // Find active video clip under playhead (check topmost track first)
  const currentVideoClip = useMemo(() => {
    if (!activeSequence) return null;
    const vTracks = activeSequence.videoTracks || [];
    for (let i = vTracks.length - 1; i >= 0; i--) {
      const track = vTracks[i];
      if (track.isVisible === false) continue;
      for (const clip of track.clips) {
        if (playheadSec >= clip.startSec && playheadSec < clip.endSec) {
          return clip;
        }
      }
    }
    return null;
  }, [activeSequence, playheadSec]);

  // Synchronize Program Monitor video player to clip offset
  useEffect(() => {
    if (!videoRef.current || !currentVideoClip || currentVideoClip.isOffline || !currentVideoClip.mediaUrl) {
      return;
    }
    const targetOffset = playheadSec - currentVideoClip.startSec + currentVideoClip.inSec;
    if (Math.abs(videoRef.current.currentTime - targetOffset) > 0.15) {
      videoRef.current.currentTime = Math.max(0, targetOffset);
    }
  }, [currentVideoClip, playheadSec]);

  // Timeline playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
      return;
    }

    lastTimeRef.current = performance.now();
    const updatePlayhead = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setPlayheadSec(prev => {
        const next = prev + deltaSec;
        if (next >= seqDurationSec) {
          if (isLooping) return 0;
          setIsPlaying(false);
          return seqDurationSec;
        }
        return next;
      });

      playheadRafRef.current = requestAnimationFrame(updatePlayhead);
    };

    playheadRafRef.current = requestAnimationFrame(updatePlayhead);
    return () => {
      if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
    };
  }, [isPlaying, isLooping, seqDurationSec]);

  // Timeline scrubber click / drag
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    setPlayheadSec(pct * seqDurationSec);
  };

  const handleStepFrame = (dir: 1 | -1) => {
    setIsPlaying(false);
    setPlayheadSec(prev => Math.max(0, Math.min(seqDurationSec, prev + dir * (1 / fps))));
  };

  const jumpToClip = (clip: PremiereClipItem) => {
    setIsPlaying(false);
    setPlayheadSec(clip.startSec);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#0b0c13] select-none overflow-hidden">
      {/* ── Top Header Bar ── */}
      <div className="h-12 px-5 border-b border-white/10 bg-[#121420] flex items-center justify-between flex-shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#9999FF]/20 border border-[#9999FF]/40 text-[#9999FF] px-2.5 py-1 rounded-lg">
            <Film className="w-3.5 h-3.5" />
            <span className="text-xs font-bold tracking-wider">PRPROJ TIMELINE</span>
          </div>
          <span className="text-sm font-bold text-white truncate max-w-sm" title={item.name}>
            {project?.projectName || item.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Sequence Selector */}
          {project && project.sequences.length > 1 && (
            <select
              value={selectedSeqIndex}
              onChange={e => {
                setSelectedSeqIndex(parseInt(e.target.value, 10));
                setPlayheadSec(0);
                setIsPlaying(false);
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500"
            >
              {project.sequences.map((s, idx) => (
                <option key={s.id} value={idx} className="bg-[#121420] text-white">
                  {s.name} ({formatTimelapse(s.durationSec)})
                </option>
              ))}
            </select>
          )}

          {/* Tab Switcher */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === 'timeline' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sequence Timeline
            </button>
            <button
              onClick={() => setActiveTab('assets')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === 'assets' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              Project Bins ({project?.assets.length || 0})
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Stage Area ── */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-indigo-400">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Decompressing & Parsing Premiere Project XML...</span>
        </div>
      ) : activeTab === 'timeline' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* ── Top Half: Program Monitor & Master HUD ── */}
          <div className="h-[46%] min-h-[220px] bg-[#07080e] border-b border-white/10 flex items-center justify-center p-3 relative">
            {/* Program Monitor Screen */}
            <div className="relative h-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
              {currentVideoClip ? (
                !currentVideoClip.isOffline && currentVideoClip.mediaUrl ? (
                  <video
                    ref={videoRef}
                    src={currentVideoClip.mediaUrl}
                    className="w-full h-full object-contain"
                    playsInline
                    muted={isMuted}
                  />
                ) : (
                  /* Classic Adobe Premiere Pro Media Offline Graphic */
                  <div className="w-full h-full bg-[#cc0000]/15 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-[#cc0000]/40">
                    <div className="w-12 h-12 rounded-xl bg-[#cc0000]/30 border border-[#cc0000] flex items-center justify-center mb-2 shadow-lg">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <span className="text-base font-black tracking-widest text-red-500 uppercase mb-1">
                      MEDIA OFFLINE
                    </span>
                    <span className="text-xs text-white font-mono font-bold truncate max-w-sm mb-1">
                      {currentVideoClip.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono truncate max-w-md">
                      {currentVideoClip.mediaPath || 'Source file path unlinked'}
                    </span>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-600 gap-1.5">
                  <Film className="w-8 h-8 opacity-30" />
                  <span className="text-[11px] font-mono text-gray-500">Empty Timeline Track Position</span>
                </div>
              )}

              {/* Top Left Current Clip Tag */}
              {currentVideoClip && (
                <div className="absolute top-2.5 left-2.5 z-10 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/15 text-[10px] font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-white font-bold truncate max-w-xs">{currentVideoClip.name}</span>
                  <span className="text-gray-400">({formatTimelapse(currentVideoClip.durationSec)})</span>
                </div>
              )}

              {/* Master Timecode Readout HUD */}
              <div className="absolute bottom-2.5 right-2.5 z-10 bg-black/90 backdrop-blur-md px-3 py-1 rounded-md border border-white/20 text-xs font-mono font-bold tracking-widest text-amber-400 shadow-xl">
                {formatTimecode(playheadSec, fps)}
              </div>
            </div>

            {/* Floating Transport Bar */}
            <div className="absolute bottom-3 left-6 z-20 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-xl">
              <button
                onClick={() => handleStepFrame(-1)}
                className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title="Step 1 Frame Back (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsPlaying(p => !p)}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all hover:scale-105"
                title={isPlaying ? 'Pause (Space)' : 'Play Timeline (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>
              <button
                onClick={() => handleStepFrame(1)}
                className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title="Step 1 Frame Forward (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPlayheadSec(0)}
                className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title="Return to Timeline Start (Home)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3.5 bg-white/20 mx-1" />
              <button
                onClick={() => setIsMuted(m => !m)}
                className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ── Bottom Half: Multi-Track NLE Timeline ── */}
          <div className="flex-1 flex flex-col bg-[#10111a] overflow-hidden">
            {/* Timeline Time Ruler */}
            <div className="h-7 border-b border-white/10 bg-[#161826] flex items-center relative overflow-hidden flex-shrink-0">
              <div className="w-20 border-r border-white/10 h-full flex items-center justify-center text-[10px] font-mono text-gray-500 bg-[#121420] flex-shrink-0">
                TIMELINE
              </div>
              <div
                onClick={handleTimelineClick}
                className="flex-1 h-full relative cursor-pointer flex items-center"
              >
                {/* Time Ruler Marks */}
                {Array.from({ length: 11 }).map((_, i) => {
                  const sec = (seqDurationSec / 10) * i;
                  return (
                    <div
                      key={i}
                      style={{ left: `${i * 10}%` }}
                      className="absolute top-0 bottom-0 flex flex-col justify-between border-l border-white/10 pl-1 pointer-events-none"
                    >
                      <span className="text-[9px] font-mono text-gray-400">{formatTimelapse(sec)}</span>
                    </div>
                  );
                })}

                {/* Scrubber Playhead Flag on Ruler */}
                <div
                  style={{ left: `${(playheadSec / seqDurationSec) * 100}%` }}
                  className="absolute top-0 bottom-0 w-3 -ml-1.5 flex flex-col items-center pointer-events-none z-30"
                >
                  <div className="w-3 h-3 bg-red-500 rotate-45 transform -translate-y-1 shadow-md" />
                </div>
              </div>
            </div>

            {/* Timeline Tracks Area */}
            <div
              ref={timelineContainerRef}
              onClick={handleTimelineClick}
              className="flex-1 overflow-y-auto relative p-1.5 space-y-1 cursor-pointer bg-[#0e0f18]"
            >
              {/* Playhead Red Needle traversing tracks */}
              <div
                style={{ left: `calc(5rem + ${(playheadSec / seqDurationSec) * 100}% * ((100% - 5rem) / 100%))` }}
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              />

              {/* Video Tracks (V3, V2, V1) */}
              {(activeSequence?.videoTracks || []).map(track => (
                <div key={`v-${track.trackIndex}`} className="flex items-center h-11 relative">
                  {/* Track Header */}
                  <div className="w-20 h-full bg-[#161826] border border-white/10 rounded-l-lg flex items-center justify-between px-2 flex-shrink-0 z-20">
                    <span className="text-xs font-bold text-indigo-400 font-mono">{track.label}</span>
                    <span className="text-[9px] text-gray-500 uppercase">VID</span>
                  </div>

                  {/* Track Timeline Lane */}
                  <div className="flex-1 h-full bg-[#131522] border-y border-r border-white/5 rounded-r-lg relative overflow-hidden">
                    {track.clips.map((clip, cIdx) => {
                      const leftPct = (clip.startSec / seqDurationSec) * 100;
                      const widthPct = Math.max(0.5, (clip.durationSec / seqDurationSec) * 100);
                      const isSelected = currentVideoClip?.id === clip.id;
                      const bg = getClipColor(clip.name, cIdx);

                      return (
                        <div
                          key={clip.id}
                          onClick={e => {
                            e.stopPropagation();
                            jumpToClip(clip);
                          }}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: bg
                          }}
                          className={`absolute top-0.5 bottom-0.5 rounded-md px-2 flex items-center justify-between text-xs text-white border transition-all cursor-pointer shadow-xs truncate ${
                            isSelected
                              ? 'border-white ring-2 ring-white/50 z-20 brightness-110'
                              : 'border-black/30 hover:brightness-110'
                          }`}
                          title={`${clip.name}\nStart: ${formatTimelapse(clip.startSec)}\nDuration: ${formatTimelapse(clip.durationSec)}`}
                        >
                          <span className="font-semibold text-[11px] truncate">{clip.name}</span>
                          <span className="text-[9px] font-mono opacity-80 ml-1 flex-shrink-0">
                            {formatTimelapse(clip.durationSec)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Audio Tracks (A1, A2) */}
              {(activeSequence?.audioTracks || []).map(track => (
                <div key={`a-${track.trackIndex}`} className="flex items-center h-10 relative">
                  {/* Track Header */}
                  <div className="w-20 h-full bg-[#161826] border border-white/10 rounded-l-lg flex items-center justify-between px-2 flex-shrink-0 z-20">
                    <span className="text-xs font-bold text-emerald-400 font-mono">{track.label}</span>
                    <span className="text-[9px] text-gray-500 uppercase">AUD</span>
                  </div>

                  {/* Track Lane */}
                  <div className="flex-1 h-full bg-[#11161f] border-y border-r border-white/5 rounded-r-lg relative overflow-hidden">
                    {track.clips.map(clip => {
                      const leftPct = (clip.startSec / seqDurationSec) * 100;
                      const widthPct = Math.max(0.5, (clip.durationSec / seqDurationSec) * 100);

                      return (
                        <div
                          key={clip.id}
                          onClick={e => {
                            e.stopPropagation();
                            jumpToClip(clip);
                          }}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`
                          }}
                          className="absolute top-0.5 bottom-0.5 bg-[#1F4E5B] border border-[#2B7D91] rounded-md px-2 flex items-center justify-between text-xs text-white truncate cursor-pointer hover:brightness-110"
                        >
                          <span className="font-medium text-[10.5px] truncate">{clip.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Project Assets & Relink Bins View ── */
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#0d0e16]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Project Media Assets ({project?.assets.length || 0})</span>
            <span className="text-xs text-gray-400">
              Verified online/offline asset status directly against local disk paths
            </span>
          </div>

          <div className="border border-white/10 rounded-xl overflow-hidden bg-[#121420]">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#181a2b] text-gray-400 border-b border-white/10 font-mono">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Clip Name</th>
                  <th className="py-2.5 px-3">Resolved Path</th>
                  <th className="py-2.5 px-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(project?.assets || []).map(asset => (
                  <tr key={asset.id} className="hover:bg-white/[0.03]">
                    <td className="py-2 px-3">
                      {asset.isOffline ? (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <XCircle className="w-3 h-3" /> Offline
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Online
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-semibold text-white truncate max-w-xs">{asset.name}</td>
                    <td className="py-2 px-3 font-mono text-gray-400 truncate max-w-md">
                      {asset.resolvedPath || asset.filePath}
                    </td>
                    <td className="py-2 px-3 font-mono text-indigo-300">
                      {asset.durationSec ? formatTimelapse(asset.durationSec) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
