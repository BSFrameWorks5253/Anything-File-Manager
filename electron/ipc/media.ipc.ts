import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// In-memory cache for video metadata & frame thumbnails
const videoMetaCache = new Map<string, { duration: number; thumb: string }>();

/**
 * Extract video duration (in seconds) via ffprobe or Windows Shell COM
 */
async function extractDuration(filePath: string): Promise<number> {
  // 1. Try ffprobe (fastest, supports virtually all containers & codecs)
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 4000 }
    );
    const parsed = parseFloat(stdout.trim());
    if (isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 10) / 10;
    }
  } catch {}

  // 2. Fallback: Windows Shell COM (Property 27 = Duration)
  if (process.platform === 'win32') {
    try {
      const dir = path.dirname(filePath).replace(/'/g, "''");
      const leaf = path.basename(filePath).replace(/'/g, "''");
      const psCmd = `powershell -NoProfile -Command "$shell = New-Object -ComObject Shell.Application; $folder = $shell.Namespace('${dir}'); $item = $folder.ParseName('${leaf}'); $folder.GetDetailsOf($item, 27)"`;
      const { stdout } = await execAsync(psCmd, { timeout: 3000 });
      const raw = stdout.trim(); // e.g. "00:00:10" or "01:23:45"
      if (raw && raw.includes(':')) {
        const parts = raw.split(':').map(p => parseInt(p, 10));
        if (parts.length === 3 && parts.every(p => !isNaN(p))) {
          const totalSecs = parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (totalSecs > 0) return totalSecs;
        }
      }
    } catch {}
  }

  return 0;
}

/**
 * Extract video thumbnail frame via ffmpeg
 */
async function extractThumbnailFrame(filePath: string, duration: number): Promise<string> {
  // Seek target: 10% of duration, or 1s, or 0.1s for short clips
  let seekSecs = 0.5;
  if (duration > 1) {
    seekSecs = Math.min(Math.max(1, duration * 0.1), duration - 0.2);
  }

  const seekFormatted = new Date(seekSecs * 1000).toISOString().substr(11, 8) + '.' + String(Math.floor((seekSecs % 1) * 1000)).padStart(3, '0');

  try {
    const cmd = `ffmpeg -ss ${seekFormatted} -i "${filePath}" -vframes 1 -vf "scale=360:-1" -f image2 -update 1 pipe:1`;
    const { stdout: buf } = await execAsync(cmd, {
      encoding: 'buffer',
      maxBuffer: 15 * 1024 * 1024,
      timeout: 5000
    });
    if (buf && buf.length > 0) {
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
  } catch {}

  // Fallback: Try seeking at start of file
  try {
    const cmd = `ffmpeg -ss 00:00:00.100 -i "${filePath}" -vframes 1 -vf "scale=360:-1" -f image2 -update 1 pipe:1`;
    const { stdout: buf } = await execAsync(cmd, {
      encoding: 'buffer',
      maxBuffer: 15 * 1024 * 1024,
      timeout: 4000
    });
    if (buf && buf.length > 0) {
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
  } catch {}

  return '';
}

/**
 * Registers all media explorer & viewer IPC handlers
 */
export function registerMediaIPC(
  getMainWindow: () => BrowserWindow | null,
  getInitialFile: () => string | null
): void {
  ipcMain.handle('media:listDir', async (_event, dirPath: string) => {
    try {
      if (!dirPath || !fs.existsSync(dirPath)) return [];
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .map(e => {
          const fullPath = path.join(dirPath, e.name);
          let size = 0,
            mtime = 0;
          try {
            const stat = fs.statSync(fullPath);
            size = stat.size;
            mtime = stat.mtimeMs;
          } catch {}
          const ext = e.isDirectory() ? '' : (e.name.split('.').pop() || '').toLowerCase();
          return {
            name: e.name,
            isDir: e.isDirectory(),
            size,
            mtime,
            ext,
            fullPath
          };
        })
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    } catch (err: any) {
      console.error('[media:listDir] Error:', err);
      return [];
    }
  });

  ipcMain.handle('media:getDrives', async () => {
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\\\';
      try {
        if (fs.existsSync(drive)) drives.push(drive);
      } catch {}
    }
    return drives;
  });

  ipcMain.handle('media:getDrivesWithSpace', async () => {
    const drives: { drive: string; total: number; free: number; usedPercent: number }[] = [];
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      try {
        if (fs.existsSync(drive)) {
          let total = 0,
            free = 0,
            usedPercent = 0;
          try {
            const stats = fs.statfsSync(drive);
            total = stats.blocks * stats.bsize;
            free = stats.bavail * stats.bsize;
            usedPercent = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
          } catch {}
          drives.push({ drive, total, free, usedPercent });
        }
      } catch {}
    }
    return drives;
  });

  ipcMain.handle('media:getQuickAccess', async () => {
    try {
      const items = [
        { name: 'Home', path: app.getPath('home'), icon: 'home' },
        { name: 'Desktop', path: app.getPath('desktop'), icon: 'desktop' },
        { name: 'Downloads', path: app.getPath('downloads'), icon: 'downloads' },
        { name: 'Pictures', path: app.getPath('pictures'), icon: 'pictures' },
        { name: 'Videos', path: app.getPath('videos'), icon: 'videos' },
        { name: 'Documents', path: app.getPath('documents'), icon: 'documents' }
      ];
      return items.filter(i => fs.existsSync(i.path));
    } catch {
      return [];
    }
  });

  ipcMain.handle('media:readImageBase64', async (_event, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const MIME_MAP: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.avif': 'image/avif',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff'
      };
      const mime = MIME_MAP[ext] || 'image/jpeg';
      const buf = fs.readFileSync(filePath);
      return {
        ok: true,
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`
      };
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) };
    }
  });

  /**
   * Fast native extraction of video duration and thumbnail frame
   */
  ipcMain.handle('media:getVideoMetadata', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found' };
      }

      // Check cache first
      const cached = videoMetaCache.get(filePath);
      if (cached) {
        return { ok: true, duration: cached.duration, thumb: cached.thumb };
      }

      // Extract duration & thumbnail
      const duration = await extractDuration(filePath);
      const thumb = await extractThumbnailFrame(filePath, duration);

      const result = { duration, thumb };
      if (thumb || duration > 0) {
        videoMetaCache.set(filePath, result);
      }

      return {
        ok: true,
        duration,
        thumb
      };
    } catch (err: any) {
      console.error('[media:getVideoMetadata] Error:', err);
      return { ok: false, error: err.message || String(err), duration: 0, thumb: '' };
    }
  });

  ipcMain.handle('media:selectFolder', async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Folder to Browse Media'
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('media:saveSnapshot', async (_event, dataUrl: string, defaultName: string) => {
    const win = getMainWindow();
    if (!win) return { ok: false };
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Frame Snapshot',
      defaultPath: path.join(
        app.getPath('pictures') || app.getPath('desktop'),
        defaultName || `snapshot_${Date.now()}.jpg`
      ),
      filters: [
        { name: 'JPEG Image', extensions: ['jpg'] },
        { name: 'PNG Image', extensions: ['png'] }
      ]
    });
    if (result.canceled || !result.filePath) return { ok: false };
    try {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
      return { ok: true, filePath: result.filePath };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('media:openInExplorer', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('media:openExternal', async (_event, filePath: string) => {
    await shell.openPath(filePath);
    return true;
  });

  ipcMain.handle('media:getInitialFile', async () => getInitialFile());
}
