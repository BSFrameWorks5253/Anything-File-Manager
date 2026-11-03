export interface FsItem {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
  ext: string;
  fullPath: string;
}

export type FilterCategory = 'all' | 'photo' | 'video' | 'timelapse';
export type ViewMode = 'grid' | 'table';

export interface VideoThumbnailData {
  thumb: string;
  duration: number;
}

export interface ZoomPanState {
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
}

export interface MediaViewerAPI {
  listDir: (dirPath: string) => Promise<FsItem[]>;
  getDrives: () => Promise<string[]>;
  readImageBase64: (filePath: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
  selectFolder: () => Promise<string | null>;
  saveSnapshot: (dataUrl: string, defaultName: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  openInExplorer: (filePath: string) => Promise<boolean>;
  openExternal: (filePath: string) => Promise<boolean>;
  getInitialFile: () => Promise<string | null>;
  getVideoMetadata: (filePath: string) => Promise<{ ok: boolean; duration: number; thumb: string; error?: string }>;
  toLocalResourceUrl: (filePath: string) => string;
  onOpenTarget: (cb: (targetPath: string) => void) => () => void;
  registerDefaultViewer: (categories: ('videos' | 'photos')[]) => Promise<{ ok: boolean; registeredCount?: number; total?: number; error?: string }>;
  checkDefaultStatus: () => Promise<{ isVideoDefault: boolean; isPhotoDefault: boolean }>;
  unregisterDefaultViewer: () => Promise<{ ok: boolean; error?: string }>;
  openWindowsDefaultAppsSettings: () => Promise<boolean>;
}
