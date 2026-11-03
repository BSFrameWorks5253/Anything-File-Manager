import { useState, useCallback, useEffect } from 'react';
import { FsItem } from '../types';
import { mediaService } from '../services';

export function useMediaNavigation() {
  const [drives, setDrives] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const navigate = useCallback(async (dirPath: string) => {
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

  const refresh = useCallback(() => {
    if (currentPath) loadPath(currentPath);
  }, [currentPath, loadPath]);

  useEffect(() => {
    mediaService.getDrives().then(d => {
      setDrives(d);
      if (d.length > 0 && !currentPath) {
        navigate(d[0]);
      }
    });
  }, []);

  return {
    drives,
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
    canGoBack: historyIdx > 0,
    canGoForward: historyIdx < history.length - 1,
    breadcrumbs: currentPath.replace(/\\/g, '/').split('/').filter(Boolean)
  };
}
