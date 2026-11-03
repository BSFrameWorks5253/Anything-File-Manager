import { FsItem, MediaViewerAPI } from '../types';

const api = (window as any).mediaViewerAPI as MediaViewerAPI | undefined;

export const mediaService = {
  async listDir(dirPath: string): Promise<FsItem[]> {
    if (!api?.listDir) return [];
    return api.listDir(dirPath);
  },

  async getDrives(): Promise<string[]> {
    if (!api?.getDrives) return [];
    return api.getDrives();
  },

  async getDrivesWithSpace(): Promise<import('../types').DriveInfo[]> {
    if (!api?.getDrivesWithSpace) return [];
    return api.getDrivesWithSpace();
  },

  async getQuickAccess(): Promise<import('../types').QuickAccessItem[]> {
    if (!api?.getQuickAccess) return [];
    return api.getQuickAccess();
  },

  async readImageBase64(filePath: string): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
    if (!api?.readImageBase64) return { ok: false, error: 'API unavailable' };
    return api.readImageBase64(filePath);
  },

  async selectFolder(): Promise<string | null> {
    if (!api?.selectFolder) return null;
    return api.selectFolder();
  },

  async saveSnapshot(dataUrl: string, defaultName: string): Promise<{ ok: boolean; filePath?: string; error?: string }> {
    if (!api?.saveSnapshot) return { ok: false, error: 'API unavailable' };
    return api.saveSnapshot(dataUrl, defaultName);
  },

  async openInExplorer(filePath: string): Promise<boolean> {
    if (!api?.openInExplorer) return false;
    return api.openInExplorer(filePath);
  },

  async openExternal(filePath: string): Promise<boolean> {
    if (!api?.openExternal) return false;
    return api.openExternal(filePath);
  },

  async getInitialFile(): Promise<string | null> {
    if (!api?.getInitialFile) return null;
    return api.getInitialFile();
  },

  async getVideoMetadata(filePath: string): Promise<{ ok: boolean; duration: number; thumb: string; error?: string }> {
    if (!api?.getVideoMetadata) return { ok: false, duration: 0, thumb: '', error: 'API unavailable' };
    return api.getVideoMetadata(filePath);
  },

  toLocalResourceUrl(filePath: string): string {
    if (api?.toLocalResourceUrl) {
      return api.toLocalResourceUrl(filePath);
    }
    const f = filePath.replace(/\\/g, '/');
    return `local-resource:///${encodeURI(f).replace(/^\//, '')}`;
  },

  onOpenTarget(cb: (targetPath: string) => void): () => void {
    if (!api?.onOpenTarget) return () => {};
    return api.onOpenTarget(cb);
  },

  async registerDefaultViewer(categories: ('videos' | 'photos')[]): Promise<{ ok: boolean; registeredCount?: number; total?: number; error?: string }> {
    if (!api?.registerDefaultViewer) return { ok: false, error: 'API not available' };
    return api.registerDefaultViewer(categories);
  },

  async checkDefaultStatus(): Promise<{ isVideoDefault: boolean; isPhotoDefault: boolean }> {
    if (!api?.checkDefaultStatus) return { isVideoDefault: false, isPhotoDefault: false };
    return api.checkDefaultStatus();
  },

  async unregisterDefaultViewer(): Promise<{ ok: boolean; error?: string }> {
    if (!api?.unregisterDefaultViewer) return { ok: false, error: 'API not available' };
    return api.unregisterDefaultViewer();
  },

  async openWindowsDefaultAppsSettings(): Promise<boolean> {
    if (!api?.openWindowsDefaultAppsSettings) return false;
    return api.openWindowsDefaultAppsSettings();
  }
};
