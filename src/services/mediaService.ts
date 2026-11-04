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

  async readTextFile(filePath: string, maxBytes?: number): Promise<{ ok: boolean; content?: string; lineCount?: number; isTruncated?: boolean; totalBytes?: number; error?: string }> {
    if (!api?.readTextFile) return { ok: false, error: 'API unavailable' };
    return api.readTextFile(filePath, maxBytes);
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

  async createFolder(parentDir: string, customName?: string): Promise<{ ok: boolean; path?: string; name?: string; error?: string }> {
    if (!api?.createFolder) return { ok: false, error: 'API unavailable' };
    return api.createFolder(parentDir, customName);
  },

  async createFile(parentDir: string, fileName?: string, defaultContent = ''): Promise<{ ok: boolean; path?: string; name?: string; error?: string }> {
    if (!api?.createFile) return { ok: false, error: 'API unavailable' };
    return api.createFile(parentDir, fileName, defaultContent);
  },

  async renameItem(oldPath: string, newName: string): Promise<{ ok: boolean; newPath?: string; name?: string; error?: string }> {
    if (!api?.renameItem) return { ok: false, error: 'API unavailable' };
    return api.renameItem(oldPath, newName);
  },

  async deleteItems(filePaths: string[], permanent = false): Promise<{ ok: boolean; deletedCount: number; errors?: string[] }> {
    if (!api?.deleteItems) return { ok: false, deletedCount: 0, errors: ['API unavailable'] };
    return api.deleteItems(filePaths, permanent);
  },

  async clipboardPaste(targetDir: string, sourcePaths: string[], operation: 'copy' | 'move'): Promise<{ ok: boolean; pastedCount: number; errors?: string[] }> {
    if (!api?.clipboardPaste) return { ok: false, pastedCount: 0, errors: ['API unavailable'] };
    return api.clipboardPaste(targetDir, sourcePaths, operation);
  },

  async duplicateItem(sourcePath: string): Promise<{ ok: boolean; newPath?: string; name?: string; error?: string }> {
    if (!api?.duplicateItem) return { ok: false, error: 'API unavailable' };
    return api.duplicateItem(sourcePath);
  },

  async getFileTags(): Promise<Record<string, string>> {
    if (!api?.getFileTags) return {};
    return api.getFileTags();
  },

  async setFileTag(filePath: string, tagColor: string | null): Promise<{ ok: boolean; error?: string }> {
    if (!api?.setFileTag) return { ok: false, error: 'API unavailable' };
    return api.setFileTag(filePath, tagColor);
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

  minimizeWindow(): void {
    api?.minimizeWindow?.();
  },

  maximizeWindow(): void {
    api?.maximizeWindow?.();
  },

  closeWindow(): void {
    api?.closeWindow?.();
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
  },

  async analyzeAfmFolder(folderPath: string): Promise<any> {
    if (!api?.analyzeAfmFolder) return null;
    return api.analyzeAfmFolder(folderPath);
  },

  async setAfmStage(folderPath: string, stage: string): Promise<boolean> {
    if (!api?.setAfmStage) return false;
    return api.setAfmStage(folderPath, stage);
  },

  async generatePremiereProject(payload: {
    folderPath: string;
    projectName: string;
    resolution: '1080p' | '4k';
    fps: number;
    openAfterCreate: boolean;
  }): Promise<{ ok: boolean; prprojPath?: string; xmlPath?: string; error?: string }> {
    if (!api?.generatePremiereProject) return { ok: false, error: 'API not available' };
    return api.generatePremiereProject(payload);
  },

  async openSeparatePlayer(filePath: string): Promise<{ ok: boolean; error?: string }> {
    if (!api?.openSeparatePlayer) return { ok: false, error: 'API not available' };
    return api.openSeparatePlayer(filePath);
  }
};
