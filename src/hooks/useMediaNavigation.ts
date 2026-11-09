import { useState, useCallback, useEffect, useRef } from 'react';
import { FsItem, QuickAccessItem, DriveInfo } from '../types';
import { mediaService } from '../services';

export function useMediaNavigation() {
  const [drives, setDrives] = useState<string[]>([]);
  const [drivesWithSpace, setDrivesWithSpace] = useState<DriveInfo[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Cancellation sequence token to prevent race conditions & flickering
  const navSeqRef = useRef(0);
  const currentPathRef = useRef('');
  currentPathRef.current = currentPath;

  const navigate = useCallback(async (dirPath: string) => {
    if (!dirPath) return;
    const reqSeq = ++navSeqRef.current;
    setLoading(true);
    try {
      const results = await mediaService.listDir(dirPath);
      if (reqSeq !== navSeqRef.current) {
        // Discard stale in-flight results
        return;
      }
      setItems(results || []);
      setCurrentPath(dirPath);
      setHistory(prev => {
        const next = [...prev.slice(0, historyIdx + 1), dirPath];
        setHistoryIdx(next.length - 1);
        return next;
      });
    } catch (err) {
      if (reqSeq === navSeqRef.current) {
        console.error('[useMediaNavigation] navigate error:', err);
        setItems([]);
      }
    } finally {
      if (reqSeq === navSeqRef.current) {
        setLoading(false);
      }
    }
  }, [historyIdx]);

  const loadPath = useCallback(async (p: string) => {
    if (!p) return;
    const reqSeq = ++navSeqRef.current;
    setLoading(true);
    try {
      const results = await mediaService.listDir(p);
      if (reqSeq !== navSeqRef.current) {
        return;
      }
      setItems(results || []);
      setCurrentPath(p);
    } catch (err) {
      if (reqSeq === navSeqRef.current) {
        console.error('[useMediaNavigation] loadPath error:', err);
        setItems([]);
      }
    } finally {
      if (reqSeq === navSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(h => h - 1);
      loadPath(prev);
    }
  }, [history, historyIdx, loadPath]);

  const goForward = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(h => h + 1);
      loadPath(next);
    }
  }, [history, historyIdx, loadPath]);

  const goUp = useCallback(() => {
    if (!currentPath) return;
    const clean = currentPath.replace(/\\/g, '/').replace(/\/$/, '');
    const lastSlash = clean.lastIndexOf('/');
    if (lastSlash > 0) {
      const parent = clean.substring(0, lastSlash);
      navigate(parent.endsWith(':') ? parent + '\\' : parent);
    } else if (clean.includes(':')) {
      navigate(clean.substring(0, clean.indexOf(':') + 1) + '\\');
    }
  }, [currentPath, navigate]);

  const refresh = useCallback(() => {
    if (currentPath) loadPath(currentPath);
  }, [currentPath, loadPath]);

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch drives & storage space
    mediaService.getDrivesWithSpace().then(dInfo => {
      if (isMounted) {
        setDrivesWithSpace(dInfo);
        setDrives(dInfo.map(d => d.drive));
      }
    });

    // 2. Fetch Quick Access & initial path safely without overriding CLI/external targets
    (async () => {
      try {
        const initialFile = await mediaService.getInitialFile();
        const qa = await mediaService.getQuickAccess();
        if (!isMounted) return;
        setQuickAccess(qa);

        // If an initial file/folder target was already provided, do not navigate to default folder!
        if (initialFile || currentPathRef.current) {
          return;
        }

        const defaultFolder = qa.find(q => q.icon === 'videos' || q.icon === 'pictures' || q.icon === 'desktop') || qa[0];
        if (defaultFolder && !currentPathRef.current) {
          navigate(defaultFolder.path);
        } else if (!currentPathRef.current) {
          const d = await mediaService.getDrives();
          if (isMounted && d.length > 0 && !currentPathRef.current) {
            navigate(d[0]);
          }
        }
      } catch (err) {
        console.warn('[useMediaNavigation] initial load error:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    drives,
    drivesWithSpace,
    quickAccess,
    currentPath,
    setCurrentPath,
    items,
    setItems,
    loading,
    navigate,
    loadPath,
    refresh,
    goBack,
    goForward,
    goUp,
    canGoBack: historyIdx > 0,
    canGoForward: historyIdx < history.length - 1,
    canGoUp: Boolean(currentPath && currentPath.length > 3),
    breadcrumbs: currentPath.replace(/\\/g, '/').split('/').filter(Boolean)
  };
}
