export interface FsItem {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
  ext: string;
  fullPath: string;
  isHidden?: boolean;
  childCount?: number;
}

export type FilterCategory = 'all' | 'photo' | 'video' | 'timelapse';
export type ViewMode = 'grid' | 'table' | 'columns' | 'gallery';

export type SortField = 'name' | 'date' | 'size' | 'ext';
export type SortOrder = 'asc' | 'desc';

export interface QuickAccessItem {
  name: string;
  path: string;
  icon: 'desktop' | 'downloads' | 'pictures' | 'videos' | 'documents' | 'home';
}

export interface DriveInfo {
  drive: string;
  total: number;
  free: number;
  usedPercent: number;
}

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
  getDrivesWithSpace?: () => Promise<DriveInfo[]>;
  getQuickAccess?: () => Promise<QuickAccessItem[]>;
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
  minimizeWindow?: () => void;
  maximizeWindow?: () => void;
  closeWindow?: () => void;
  // AFM (Anything Production File Manager) & One Tap Ecosystem APIs
  analyzeAfmFolder?: (folderPath: string) => Promise<any>;
  setAfmStage?: (folderPath: string, stage: string) => Promise<boolean>;
  generatePremiereProject?: (payload: any) => Promise<{ ok: boolean; prprojPath?: string; xmlPath?: string; error?: string }>;
  getSubfoldersPreflight?: (folderPath: string) => Promise<{ ok: boolean; folderPath?: string; subfolders?: any[]; error?: string }>;
  openOneTap?: (targetPath?: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  sendToTitleAdder?: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
  openSeparatePlayer?: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  getTaskTrackerStats?: (dateSession: string, safarName?: string) => Promise<any>;
  verifyBackupSync?: (folderPath: string, targetBackupDir: string) => Promise<any>;
  separatePhotosAndVideos?: (sourceDir: string, destDir?: string, mode?: 'copy' | 'move') => Promise<any>;
  dispatchAmbientEvent?: (payload: { title: string; message: string; sound?: boolean }) => Promise<{ ok: boolean }>;
  getDiskHealth?: (drivePath: string) => Promise<any>;
  readTextFile?: (filePath: string, maxBytes?: number) => Promise<{ ok: boolean; content?: string; lineCount?: number; isTruncated?: boolean; totalBytes?: number; error?: string }>;
  // Full CRUD File Engine & Cross-Disk Operations
  createFolder?: (parentDir: string, customName?: string) => Promise<{ ok: boolean; path?: string; name?: string; error?: string }>;
  createFile?: (parentDir: string, fileName?: string, defaultContent?: string) => Promise<{ ok: boolean; path?: string; name?: string; error?: string }>;
  renameItem?: (oldPath: string, newName: string) => Promise<{ ok: boolean; newPath?: string; name?: string; error?: string }>;
  deleteItems?: (filePaths: string[], permanent?: boolean) => Promise<{ ok: boolean; deletedCount: number; errors?: string[] }>;
  clipboardPaste?: (targetDir: string, sourcePaths: string[], operation: 'copy' | 'move') => Promise<{ ok: boolean; pastedCount: number; errors?: string[] }>;
  duplicateItem?: (sourcePath: string) => Promise<{ ok: boolean; newPath?: string; name?: string; error?: string }>;
  getItemsByPaths?: (filePaths: string[]) => Promise<FsItem[]>;
  getFileTags?: () => Promise<Record<string, string>>;
  setFileTag?: (filePath: string, tagColor: string | null) => Promise<{ ok: boolean; error?: string }>;
}
