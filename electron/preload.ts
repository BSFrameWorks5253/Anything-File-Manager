import { contextBridge, ipcRenderer } from 'electron';

export interface MediaViewerAPI {
  listDir: (dirPath: string) => Promise<any[]>;
  getDrives: () => Promise<string[]>;
  getDrivesWithSpace?: () => Promise<any[]>;
  getQuickAccess?: () => Promise<any[]>;
  readImageBase64: (filePath: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
  selectFolder: () => Promise<string | null>;
  saveSnapshot: (dataUrl: string, defaultName: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  openInExplorer: (filePath: string) => Promise<boolean>;
  openExternal: (filePath: string) => Promise<boolean>;
  getInitialFile: () => Promise<string | null>;
  getVideoMetadata: (filePath: string) => Promise<{ ok: boolean; duration: number; thumb: string; error?: string }>;
  toLocalResourceUrl: (filePath: string) => string;
  onOpenTarget: (cb: (targetPath: string) => void) => () => void;
  // Shell & Windows File Explorer default app integration
  registerDefaultViewer: (categories: ('videos' | 'photos')[]) => Promise<{ ok: boolean; registeredCount?: number; total?: number; error?: string }>;
  checkDefaultStatus: () => Promise<{ isVideoDefault: boolean; isPhotoDefault: boolean }>;
  unregisterDefaultViewer: () => Promise<{ ok: boolean; error?: string }>;
  openWindowsDefaultAppsSettings: () => Promise<boolean>;
  minimizeWindow?: () => void;
  maximizeWindow?: () => void;
  closeWindow?: () => void;
  // AFM (Anything Production File Manager) & One Tap Ecosystem APIs
  analyzeAfmFolder?: (folderPath: string) => Promise<any>;
  setAfmStage?: (folderPath: string, stage: string) => Promise<boolean>;
  generatePremiereProject?: (payload: any) => Promise<{ ok: boolean; prprojPath?: string; xmlPath?: string; error?: string }>;
  openSeparatePlayer?: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  getTaskTrackerStats?: (dateSession: string, safarName?: string) => Promise<any>;
  verifyBackupSync?: (folderPath: string, targetBackupDir: string) => Promise<any>;
  separatePhotosAndVideos?: (sourceDir: string, destDir?: string, mode?: 'copy' | 'move') => Promise<any>;
  dispatchAmbientEvent?: (payload: { title: string; message: string; sound?: boolean }) => Promise<{ ok: boolean }>;
  getDiskHealth?: (drivePath: string) => Promise<any>;
}

const api: MediaViewerAPI = {
  openSeparatePlayer: (filePath: string) => ipcRenderer.invoke('media:openSeparatePlayer', filePath),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  analyzeAfmFolder: (folderPath: string) => ipcRenderer.invoke('afm:analyzeFolder', folderPath),
  setAfmStage: (folderPath: string, stage: string) => ipcRenderer.invoke('afm:setStage', folderPath, stage),
  generatePremiereProject: (payload: any) => ipcRenderer.invoke('afm:generatePremiereProject', payload),
  getTaskTrackerStats: (dateSession: string, safarName?: string) => ipcRenderer.invoke('afm:getTaskTrackerStats', dateSession, safarName),
  verifyBackupSync: (folderPath: string, targetBackupDir: string) => ipcRenderer.invoke('afm:verifyBackupSync', folderPath, targetBackupDir),
  separatePhotosAndVideos: (sourceDir: string, destDir?: string, mode?: 'copy' | 'move') => ipcRenderer.invoke('afm:separatePhotosAndVideos', { sourceDir, destDir, mode }),
  dispatchAmbientEvent: (payload: { title: string; message: string; sound?: boolean }) => ipcRenderer.invoke('afm:dispatchAmbientEvent', payload),
  getDiskHealth: (drivePath: string) => ipcRenderer.invoke('afm:getDiskHealth', drivePath),
  listDir: (dirPath: string) => ipcRenderer.invoke('media:listDir', dirPath),
  getDrives: () => ipcRenderer.invoke('media:getDrives'),
  getDrivesWithSpace: () => ipcRenderer.invoke('media:getDrivesWithSpace'),
  getQuickAccess: () => ipcRenderer.invoke('media:getQuickAccess'),
  readImageBase64: (filePath: string) => ipcRenderer.invoke('media:readImageBase64', filePath),
  selectFolder: () => ipcRenderer.invoke('media:selectFolder'),
  saveSnapshot: (dataUrl: string, defaultName: string) => ipcRenderer.invoke('media:saveSnapshot', dataUrl, defaultName),
  openInExplorer: (filePath: string) => ipcRenderer.invoke('media:openInExplorer', filePath),
  openExternal: (filePath: string) => ipcRenderer.invoke('media:openExternal', filePath),
  getInitialFile: () => ipcRenderer.invoke('media:getInitialFile'),
  getVideoMetadata: (filePath: string) => ipcRenderer.invoke('media:getVideoMetadata', filePath),
  toLocalResourceUrl: (filePath: string) => {
    const f = filePath.replace(/\\/g, '/');
    return `local-resource:///${encodeURI(f).replace(/^\//, '')}`;
  },
  onOpenTarget: (cb: (targetPath: string) => void) => {
    const sub = (_e: any, target: string) => cb(target);
    ipcRenderer.on('media:openTarget', sub);
    return () => ipcRenderer.removeListener('media:openTarget', sub);
  },
  registerDefaultViewer: (categories: ('videos' | 'photos')[]) => ipcRenderer.invoke('shell:registerDefaultViewer', categories),
  checkDefaultStatus: () => ipcRenderer.invoke('shell:checkDefaultStatus'),
  unregisterDefaultViewer: () => ipcRenderer.invoke('shell:unregisterDefaultViewer'),
  openWindowsDefaultAppsSettings: () => ipcRenderer.invoke('shell:openWindowsDefaultAppsSettings')
};

contextBridge.exposeInMainWorld('mediaViewerAPI', api);
