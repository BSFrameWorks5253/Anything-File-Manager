import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Copy,
  Check,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { FsItem } from '../../types';
import { adobeService } from '../../services';
import { PsdLayerItem, PsdParseResult } from '../../../electron/ipc/adobe.ipc';
import { formatBytes } from '../../utils';

interface PsdQuickLookProps {
  item: FsItem;
}

export const PsdQuickLook: React.FC<PsdQuickLookProps> = ({ item }) => {
  const [data, setData] = useState<PsdParseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [hiddenLayers, setHiddenLayers] = useState<Set<number>>(new Set());
  const [isolatedLayerId, setIsolatedLayerId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'layers' | 'info'>('layers');

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setHiddenLayers(new Set());
    setIsolatedLayerId(null);

    adobeService.parsePsd(item.fullPath).then(res => {
      if (isCurrent) {
        setData(res);
        // Pre-populate hidden layers from PSD flags
        const initialHidden = new Set<number>();
        function scanHidden(list: PsdLayerItem[]) {
          list.forEach(l => {
            if (l.isHidden) initialHidden.add(l.id);
            if (l.children) scanHidden(l.children);
          });
        }
        scanHidden(res.layers || []);
        setHiddenLayers(initialHidden);
        setLoading(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [item.fullPath]);

  const toggleLayerVisibility = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupCollapse = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyLayerName = (layer: PsdLayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(layer.name);
    setCopiedId(layer.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(z => Math.max(0.2, Math.min(8, z * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetCanvas = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setIsolatedLayerId(null);
  };

  // Recursive layer renderer for Layers Panel
  const renderLayerRow = (layer: PsdLayerItem, depth = 0) => {
    const isHidden = hiddenLayers.has(layer.id);
    const isIsolated = isolatedLayerId === layer.id;
    const isCollapsed = collapsedGroups.has(layer.id);

    return (
      <div key={layer.id} className="flex flex-col">
        <div
          onClick={() => setIsolatedLayerId(isIsolated ? null : layer.id)}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          className={`flex items-center justify-between py-1.5 pr-2.5 rounded-lg cursor-pointer transition-all border text-xs ${
            isIsolated
              ? 'bg-blue-600/25 border-blue-500/50 text-white shadow-xs'
              : 'border-transparent hover:bg-white/[0.06] text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Visibility Toggle Eye */}
            <button
              onClick={e => toggleLayerVisibility(layer.id, e)}
              className={`p-1 rounded hover:bg-white/10 transition-colors ${
                isHidden ? 'text-gray-500 opacity-40' : 'text-blue-400'
              }`}
              title={isHidden ? 'Show Layer' : 'Hide Layer'}
            >
              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>

            {/* Folder vs Layer Icon */}
            {layer.isGroup ? (
              <button
                onClick={e => toggleGroupCollapse(layer.id, e)}
                className="text-amber-400 hover:text-amber-300 flex items-center"
              >
                {isCollapsed ? <Folder className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-4 h-4 rounded bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-2.5 h-2.5 text-indigo-300" />
              </div>
            )}

            {/* Layer Name */}
            <span
              className={`truncate font-medium text-[11.5px] ${
                isHidden ? 'line-through text-gray-500' : isIsolated ? 'font-bold text-white' : 'text-gray-200'
              }`}
              title={layer.name}
            >
              {layer.name}
            </span>
          </div>

          {/* Right Tags (Opacity / Blend Mode) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {layer.blendMode && layer.blendMode !== 'normal' && (
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {layer.blendMode.slice(0, 4)}
              </span>
            )}
            {layer.opacity < 1 && (
              <span className="text-[9.5px] font-mono text-gray-400">
                {Math.round(layer.opacity * 100)}%
              </span>
            )}
            <button
              onClick={e => handleCopyLayerName(layer, e)}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              title="Copy Layer Name"
            >
              {copiedId === layer.id ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Recursive Children for Groups */}
        {layer.isGroup && !isCollapsed && layer.children && (
          <div className="flex flex-col border-l border-white/5 ml-3 my-0.5">
            {layer.children.map(child => renderLayerRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isolatedLayer = useMemo<PsdLayerItem | null>(() => {
    if (isolatedLayerId === null || !data) return null;
    let found: PsdLayerItem | null = null;
    function find(list: PsdLayerItem[]) {
      for (const l of list) {
        if (l.id === isolatedLayerId) {
          found = l;
          return;
        }
        if (l.children) find(l.children);
      }
    }
    find(data.layers);
    return found;
  }, [isolatedLayerId, data]);

  return (
    <div className="flex-1 w-full h-full flex bg-[#0c0d14] select-none overflow-hidden">
      {/* ── Center Studio Canvas ── */}
      <div
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative flex items-center justify-center overflow-hidden bg-[#090a10] cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
        style={{
          backgroundImage: `
            linear-gradient(45deg, #12131c 25%, transparent 25%),
            linear-gradient(-45deg, #12131c 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #12131c 75%),
            linear-gradient(-45deg, transparent 75%, #12131c 75%)
          `,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px'
        }}
      >
        {/* Top Floating Controls Bar */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-xl">
          <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 mr-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            PSD Canvas
          </span>

          <button
            onClick={() => setZoom(z => Math.max(0.2, z * 0.85))}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-bold text-blue-300 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(8, z * 1.15))}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-white/20 mx-1" />

          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetCanvas}
            className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
            title="Reset Canvas & Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Isolated Layer Overlay Banner */}
        {isolatedLayer && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-blue-600/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-blue-400/40 shadow-xl text-xs font-semibold animate-in fade-in">
            <span>Inspecting Layer: <strong>{isolatedLayer.name}</strong></span>
            <button
              onClick={() => setIsolatedLayerId(null)}
              className="text-[11px] underline opacity-80 hover:opacity-100 ml-1.5"
            >
              Show Full Canvas
            </button>
          </div>
        )}

        {/* Canvas Image Container */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-blue-400">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Parsing Adobe Photoshop Layers...</span>
          </div>
        ) : data?.compositeUrl ? (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="relative shadow-2xl transition-shadow"
          >
            <img
              src={data.compositeUrl}
              alt={item.name}
              draggable={false}
              className="max-w-none rounded border border-black/30 shadow-2xl block"
              style={{
                maxWidth: '85vw',
                maxHeight: '75vh',
                objectFit: 'contain'
              }}
            />

            {/* If a layer is isolated, render an outline bounding box */}
            {isolatedLayer && data.width > 0 && data.height > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(isolatedLayer.left / data.width) * 100}%`,
                  top: `${(isolatedLayer.top / data.height) * 100}%`,
                  width: `${(isolatedLayer.width / data.width) * 100}%`,
                  height: `${(isolatedLayer.height / data.height) * 100}%`
                }}
                className="border-2 border-blue-400 bg-blue-500/10 pointer-events-none rounded shadow-md ring-2 ring-blue-500/30"
              >
                <span className="absolute -top-5 left-0 bg-blue-600 text-white text-[9px] font-bold px-1 rounded shadow">
                  {isolatedLayer.name}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
            <ImageIcon className="w-12 h-12 opacity-40" />
            <span className="text-xs">No composite preview embedded in this PSD</span>
          </div>
        )}

        {/* Bottom Left Dimensions Badge */}
        {data && data.width > 0 && (
          <div className="absolute bottom-4 left-4 z-20 bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[11px] font-mono text-gray-300 flex items-center gap-3">
            <span>
              <strong className="text-white">{data.width}</strong> × <strong className="text-white">{data.height}</strong> px
            </span>
            <span className="text-gray-500">•</span>
            <span>{data.colorMode}</span>
            <span className="text-gray-500">•</span>
            <span>{data.depth}-bit</span>
            <span className="text-gray-500">•</span>
            <span className="text-blue-400 font-bold">{data.layerCount} Layers</span>
          </div>
        )}
      </div>

      {/* ── Right Photoshop Layers Inspector Sidebar ── */}
      <div className="w-80 border-l border-white/10 bg-[#11131c] flex flex-col z-20 shadow-2xl flex-shrink-0">
        {/* Panel Header & Tabs */}
        <div className="p-3.5 border-b border-white/10 bg-[#161826] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white tracking-wide">Photoshop Studio</span>
          </div>

          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 text-[11px]">
            <button
              onClick={() => setActiveTab('layers')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                activeTab === 'layers' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              Layers ({data?.layerCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                activeTab === 'info' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              Document
            </button>
          </div>
        </div>

        {/* Panel Body */}
        {activeTab === 'layers' ? (
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-500">
                <Sparkles className="w-5 h-5 animate-spin mx-auto text-blue-400 mb-2" />
                Scanning layer tree...
              </div>
            ) : data?.layers && data.layers.length > 0 ? (
              data.layers.map(layer => renderLayerRow(layer))
            ) : (
              <div className="p-8 text-center text-xs text-gray-500">
                Flattened composite image (single background layer)
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">File Name:</span>
                <span className="font-semibold text-white truncate max-w-[150px]">{item.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Resolution:</span>
                <span className="font-mono text-white">
                  {data?.width || 0} × {data?.height || 0} px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Color Mode:</span>
                <span className="font-bold text-blue-400">{data?.colorMode || 'RGB'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bit Depth:</span>
                <span className="font-mono text-white">{data?.depth || 8}-bit per channel</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">File Size:</span>
                <span className="font-mono text-white">{formatBytes(item.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Layers:</span>
                <span className="font-bold text-white">{data?.layerCount || 0}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] leading-relaxed">
              💡 <strong>Tip:</strong> Click on any layer in the Layers list to outline and isolate its bounds on the canvas. Use the eye icon to toggle visibility.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
