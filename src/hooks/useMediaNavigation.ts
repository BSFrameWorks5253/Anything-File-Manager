import { useState, useCallback, useEffect } from 'react';
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

  const navigate = useCallback(async (dirPath: string) => {
    if (!dirPath) return;
    setLoading(true);
    const results = await mediaService.listDir(dirPath);
    setItems(results);
    setCurrentPath(dirPath);
    setHistory(prev => {
      const next = [...prev.slice(0, historyIdx + 1), dirPath];
      setHistoryIdx(next.length - 1);
      return next;
    });
    setLoading(false);
  }, [historyIdx]);

  const loadPath = useCallback(async (p: string) => {
    if (!p) return;
    setLoading(true);
    const results = await mediaService.listDir(p);
    setItems(results);
    setCurrentPath(p);
    setLoading(false);
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
    // 1. Fetch drives & storage space
    mediaService.getDrivesWithSpace().then(dInfo => {
      setDrivesWithSpace(dInfo);
      setDrives(dInfo.map(d => d.drive));
    });

    // 2. Fetch Mac/Win Quick Access paths
    mediaService.getQuickAccess().then(qa => {
      setQuickAccess(qa);
      // Prefer Videos or Pictures or Desktop or Home or first drive
      const defaultFolder = qa.find(q => q.icon === 'videos' || q.icon === 'pictures' || q.icon === 'desktop') || qa[0];
      if (defaultFolder && !currentPath) {
        navigate(defaultFolder.path);
      } else if (!currentPath) {
        mediaService.getDrives().then(d => {
          if (d.length > 0) navigate(d[0]);
        });
      }
    });
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
