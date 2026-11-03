import { MediaViewerAPI } from '../types';

export interface TaskTrackerStats {
  ok: boolean;
  task?: {
    id?: number;
    safarName?: string;
    dateFolder?: string;
    status?: string;
    renderedAt?: number;
    renderDuration?: number;
    renderVideoCount?: number;
    renderSizeBytes?: number;
    uploadedAt?: number;
    submittedAt?: number;
    workingPath?: string;
    finalPath?: string;
    notes?: string;
    updatedAt?: number;
  };
  history?: Array<{
    id: number;
    fromStatus: string;
    toStatus: string;
    eventDescription: string;
    timestamp: number;
  }>;
  renders?: Array<{
    renderId?: string;
    slotCode?: string;
    durationSecs?: number;
    renderTimeSecs?: number;
    status?: string;
  }>;
  error?: string;
}

export interface BackupSyncResult {
  ok: boolean;
  totalFiles: number;
  matchedFiles: number;
  missingFiles: string[];
  mismatchedFiles: string[];
  totalBytes: number;
  backupBytes: number;
  isFullySynced: boolean;
  error?: string;
}

export interface PVSeparateResult {
  ok: boolean;
  photoCount: number;
  videoCount: number;
  movedCount: number;
  destDir?: string;
  error?: string;
}

export interface DiskHealthResult {
  ok: boolean;
  drive: string;
  totalBytes: number;
  freeBytes: number;
  freePercent: number;
  isLowSpace: boolean;
  warning?: string;
}

export interface PremiereProjectPayload {
  folderPath: string;
  projectName: string;
  resolution: '1080p' | '4k';
  fps: number;
  openAfterCreate: boolean;
}

class OneTapService {
  private get api(): MediaViewerAPI | undefined {
    return (window as any).mediaViewerAPI as MediaViewerAPI | undefined;
  }

  /**
   * Queries One Tap's SQLite tracker DB for past render logs, stage history, and task status
   */
  async getTaskTrackerStats(dateSession: string, safarName?: string): Promise<TaskTrackerStats> {
    if (!this.api?.getTaskTrackerStats) {
      return { ok: false, error: 'One Tap Tracker API is unavailable.' };
    }
    try {
      return await this.api.getTaskTrackerStats(dateSession, safarName);
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * Generates frame-accurate Premiere Sequence XML with 4 standard bins and attempts .prproj creation
   */
  async generatePremiereProject(payload: PremiereProjectPayload): Promise<{
    ok: boolean;
    prprojPath?: string;
    xmlPath?: string;
    error?: string;
  }> {
    if (!this.api?.generatePremiereProject) {
      return { ok: false, error: 'Premiere Pro project generator is unavailable.' };
    }
    try {
      return await this.api.generatePremiereProject(payload);
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * Scans working date/session folder and compares file sizes and checksums against a backup directory
   */
  async verifyBackupSync(folderPath: string, targetBackupDir: string): Promise<BackupSyncResult> {
    if (!this.api?.verifyBackupSync) {
      return {
        ok: false,
        totalFiles: 0,
        matchedFiles: 0,
        missingFiles: [],
        mismatchedFiles: [],
        totalBytes: 0,
        backupBytes: 0,
        isFullySynced: false,
        error: 'DriveSync verification API is unavailable.'
      };
    }
    try {
      return await this.api.verifyBackupSync(folderPath, targetBackupDir);
    } catch (err: any) {
      return {
        ok: false,
        totalFiles: 0,
        matchedFiles: 0,
        missingFiles: [],
        mismatchedFiles: [],
        totalBytes: 0,
        backupBytes: 0,
        isFullySynced: false,
        error: err.message || String(err)
      };
    }
  }

  /**
   * Camera card ingest & asset segregation: sorts RAW photos & video clips
   */
  async separatePhotosAndVideos(
    sourceDir: string,
    destDir?: string,
    mode: 'copy' | 'move' = 'move'
  ): Promise<PVSeparateResult> {
    if (!this.api?.separatePhotosAndVideos) {
      return { ok: false, photoCount: 0, videoCount: 0, movedCount: 0, error: 'PV Separator API unavailable' };
    }
    try {
      return await this.api.separatePhotosAndVideos(sourceDir, destDir, mode);
    } catch (err: any) {
      return { ok: false, photoCount: 0, videoCount: 0, movedCount: 0, error: err.message || String(err) };
    }
  }

  /**
   * Shared ambient task status & sound cues across desktop windows
   */
  async dispatchAmbientEvent(title: string, message: string, sound: boolean = true): Promise<boolean> {
    if (!this.api?.dispatchAmbientEvent) return false;
    try {
      const res = await this.api.dispatchAmbientEvent({ title, message, sound });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Checks working drive space and returns a health summary (warns if <15% or <100GB free)
   */
  async getDiskHealth(drivePath: string): Promise<DiskHealthResult> {
    if (!this.api?.getDiskHealth) {
      return { ok: false, drive: drivePath, totalBytes: 0, freeBytes: 0, freePercent: 0, isLowSpace: false };
    }
    try {
      return await this.api.getDiskHealth(drivePath);
    } catch {
      return { ok: false, drive: drivePath, totalBytes: 0, freeBytes: 0, freePercent: 0, isLowSpace: false };
    }
  }
}

export const oneTapService = new OneTapService();

