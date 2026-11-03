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
  }
};
