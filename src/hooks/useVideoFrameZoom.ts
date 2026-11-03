import { useState, useRef, useCallback } from 'react';

export function useVideoFrameZoom(maxZoom = 8) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  const zoomIn = useCallback((step = 0.25) => {
    setZoom(z => Math.min(maxZoom, z + step));
  }, [maxZoom]);

  const zoomOut = useCallback((step = 0.25) => {
    setZoom(z => {
      const next = Math.max(1, z - step);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.18 : 0.18;
    setZoom(z => {
      const next = Math.min(Math.max(1, z + delta * z), maxZoom);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, [maxZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pan.x, oy: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    setPan({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my)
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isDragging,
    resetZoom,
    zoomIn,
    zoomOut,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}
