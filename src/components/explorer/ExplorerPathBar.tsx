import React, { useState, useRef, useCallback } from 'react';
import { ChevronRight, HardDrive, Folder, Compass, Copy, Check } from 'lucide-react';
import { MacFolderIcon } from '../common/MacIcons';
import { classifyFolder } from '../../utils/afmTaxonomy';
import { mediaService } from '../../services';

interface ExplorerPathBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenJumpPalette?: () => void;
  onRefresh?: () => void;
}

export const ExplorerPathBar: React.FC<ExplorerPathBarProps> = ({
  currentPath,
  onNavigate,
  onOpenJumpPalette,
  onRefresh
}) => {
  const [copied, setCopied] = useState(false);
  const [springHoverPath, setSpringHoverPath] = useState<string | null>(null);
  const springTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decompose current path into hierarchy segments
  const segments = React.useMemo(() => {
    if (!currentPath) return [];

    const norm = currentPath.replace(/\\/g, '/');
    const isWindows = /^[a-zA-Z]:/.test(norm);
    const rawParts = norm.split('/').filter(Boolean);

    const list: { name: string; fullPath: string; isDrive: boolean; isSlot: boolean }[] = [];

    let accum = '';
    rawParts.forEach((part, idx) => {
      if (idx === 0 && isWindows) {
        accum = `${part}\\`;
        list.push({
          name: part.toUpperCase(),
          fullPath: accum,
          isDrive: true,
          isSlot: false
        });
      } else {
        if (isWindows && idx === 1) {
          accum = `${list[0].fullPath}${part}`;
        } else if (accum.endsWith('\\') || accum.endsWith('/')) {
          accum = `${accum}${part}`;
        } else {
          accum = isWindows ? `${accum}\\${part}` : `${accum}/${part}`;
        }

        const classification = classifyFolder(part, accum);
        const isSlot = classification.type === 'slot_item_a' || classification.type === 'slot_item_b';

        list.push({
          name: part,
          fullPath: accum,
          isDrive: false,
          isSlot
        });
      }
    });

    return list;
  }, [currentPath]);

  // Spring-Loaded Folder Hover Handling
  const handleDragOverSegment = (e: React.DragEvent, fullPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (springHoverPath !== fullPath) {
      setSpringHoverPath(fullPath);
      if (springTimerRef.current) clearTimeout(springTimerRef.current);

      springTimerRef.current = setTimeout(() => {
        onNavigate(fullPath);
        setSpringHoverPath(null);
      }, 500); // 500ms macOS spring-loaded delay
    }
  };

  const handleDragLeaveSegment = (e: React.DragEvent, fullPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (springHoverPath === fullPath) {
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      setSpringHoverPath(null);
    }
  };

  const handleDropOnSegment = async (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    setSpringHoverPath(null);

    let itemsToMove: string[] = [];
    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) itemsToMove = parsed;
      } catch {}
    }
    if (itemsToMove.length === 0) {
      const text = e.dataTransfer.getData('text/plain');
      if (text) itemsToMove = [text];
    }

    if (itemsToMove.length > 0) {
      const op = e.altKey ? 'copy' : 'move';
      const res = await mediaService.clipboardPaste(targetDir, itemsToMove, op);
      if (res.ok && onRefresh) {
        onRefresh();
      }
    }
  };

  const handleCopyPath = () => {
    if (!currentPath) return;
    navigator.clipboard.writeText(currentPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!currentPath) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-black/[0.03] dark:bg-white/[0.03] border-t border-[var(--mac-border)] text-xs text-[var(--mac-text-secondary)] select-none transition-colors duration-200 overflow-x-auto no-scrollbar">
      {/* Breadcrumb Segments Chain */}
      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar py-0.5">
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          const isSpringing = springHoverPath === seg.fullPath;

          return (
            <React.Fragment key={seg.fullPath}>
              <div
                onClick={() => onNavigate(seg.fullPath)}
                onDragOver={e => handleDragOverSegment(e, seg.fullPath)}
                onDragLeave={e => handleDragLeaveSegment(e, seg.fullPath)}
                onDrop={e => handleDropOnSegment(e, seg.fullPath)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer transition-all duration-150 flex-shrink-0 ${
                  isSpringing
                    ? 'mac-spring-target'
                    : isLast
                    ? 'font-bold text-[var(--mac-text-primary)] bg-black/5 dark:bg-white/10'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--mac-text-primary)]'
                }`}
                title={`Jump to: ${seg.fullPath} (Hover with dragged file to Spring-Open)`}
              >
                {seg.isDrive ? (
                  <HardDrive className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                ) : seg.isSlot ? (
                  <span className="text-xs">🎯</span>
                ) : (
                  <MacFolderIcon size={14} className="flex-shrink-0" />
                )}
                <span className="truncate max-w-[160px] text-[11.5px]">{seg.name}</span>
              </div>

              {!isLast && (
                <ChevronRight className="w-3 h-3 text-[var(--mac-text-muted)] flex-shrink-0 opacity-40" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right Controls: Copy Path + Spotlight Jump Button */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <button
          onClick={handleCopyPath}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--mac-text-muted)] hover:text-[var(--mac-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Copy full directory path"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Path</span>
            </>
          )}
        </button>

        {onOpenJumpPalette && (
          <button
            onClick={onOpenJumpPalette}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--mac-accent)]/10 hover:bg-[var(--mac-accent)]/20 text-[var(--mac-accent)] text-[11px] font-semibold transition-colors"
            title="Spotlight Fuzzy Jump (Cmd+P or Ctrl+P)"
          >
            <Compass className="w-3 h-3" />
            <span>Go to Folder (⌘P)</span>
          </button>
        )}
      </div>
    </div>
  );
};
