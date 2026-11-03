import { contextBridge, ipcRenderer } from 'electron';

export interface MediaViewerAPI {
  listDir: (dirPath: string) => Promise<any[]>;
  getDrives: () => Promise<string[]>;
  readImageBase64: (filePath: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
  selectFolder: () => Promise<string | null>;
  saveSnapshot: (dataUrl: string, defaultName: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  openInExplorer: (filePath: string) => Promise<boolean>;
  openExternal: (filePath: string) => Promise<boolean>;
  getInitialFile: () => Promise<string | null>;
  toLocalResourceUrl: (filePath: string) => string;
  onOpenTarget: (cb: (targetPath: string) => void) => () => void;
}

const api: MediaViewerAPI = {
  listDir: (dirPath: string) => ipcRenderer.invoke('media:listDir', dirPath),
  getDrives: () => ipcRenderer.invoke('media:getDrives'),
  readImageBase64: (filePath: string) => ipcRenderer.invoke('media:readImageBase64', filePath),
  selectFolder: () => ipcRenderer.invoke('media:selectFolder'),
  saveSnapshot: (dataUrl: string, defaultName: string) => ipcRenderer.invoke('media:saveSnapshot', dataUrl, defaultName),
  openInExplorer: (filePath: string) => ipcRenderer.invoke('media:openInExplorer', filePath),
  openExternal: (filePath: string) => ipcRenderer.invoke('media:openExternal', filePath),
  getInitialFile: () => ipcRenderer.invoke('media:getInitialFile'),
  toLocalResourceUrl: (filePath: string) => {
    const f = filePath.replace(/\\/g, '/');
    return `local-resource:///${encodeURI(f).replace(/^\//, '')}`;
  },
  onOpenTarget: (cb: (targetPath: string) => void) => {
    const sub = (_e: any, target: string) => cb(target);
    ipcRenderer.on('media:openTarget', sub);
    return () => ipcRenderer.removeListener('media:openTarget', sub);
  }
};

contextBridge.exposeInMainWorld('mediaViewerAPI', api);
