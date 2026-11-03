import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Camera RAW extensions
const RAW_EXTS = new Set([
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'pef', 'sr2', 'srf'
]);

// Persistent Disk Thumbnail Cache Directory
let thumbCacheDir: string | null = null;
function getThumbCacheDir(): string {
  if (!thumbCacheDir) {
    thumbCacheDir = path.join(app.getPath('userData'), 'thumb-cache');
    if (!fs.existsSync(thumbCacheDir)) {
      try {
        fs.mkdirSync(thumbCacheDir, { recursive: true });
      } catch {}
    }
  }
  return thumbCacheDir;
}

function getCacheKey(filePath: string, stat: fs.Stats): string {
  return crypto.createHash('md5').update(`${filePath}:${stat.size}:${stat.mtimeMs}`).digest('hex');
}

// In-memory cache for ultra-fast UI rendering
const memThumbCache = new Map<string, { thumb: string; duration?: number }>();

/**
 * Super-fast pure Node buffer extractor for embedded JPEGs inside Camera RAW files
 * (.CR3, .CR2, .NEF, .ARW, .DNG, .RAF, etc.)
 * Reads up to 4MB in ~2-15ms and extracts the embedded JPEG preview.
 */
function extractEmbeddedRawJpeg(filePath: string, forThumbnail = true): Buffer | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    // For thumbnails, 4MB is more than enough; for full view, up to 10MB
    const READ_SIZE = forThumbnail ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
    const buf = Buffer.alloc(READ_SIZE);
    const bytesRead = fs.readSync(fd, buf, 0, READ_SIZE, 0);
    fs.closeSync(fd);

    const jpegs: Buffer[] = [];
    for (let i = 0; i < bytesRead - 4; i++) {
      // JPEG SOI: FF D8 FF
      if (buf[i] === 0xFF && buf[i+1] === 0xD8 && buf[i+2] === 0xFF) {
        for (let j = i + 100; j < bytesRead - 1; j++) {
          // JPEG EOI: FF D9
          if (buf[j] === 0xFF && buf[j+1] === 0xD9) {
            const slice = buf.subarray(i, j + 2);
            jpegs.push(slice);
            i = j + 2;
            break;
          }
        }
      }
    }

    if (jpegs.length === 0) return null;

    if (forThumbnail) {
      // For grid thumbnail, prefer a medium preview (50KB to 700KB)
      const medium = jpegs.find(b => b.length >= 40 * 1024 && b.length <= 800 * 1024);
      if (medium) return medium;
      // Fallback: sort descending
      return jpegs.sort((a, b) => b.length - a.length)[0];
    } else {
      // For fullscreen HD viewing, return the largest preview available
      return jpegs.sort((a, b) => b.length - a.length)[0];
    }
  } catch (err) {
    console.error('[extractEmbeddedRawJpeg] Error:', err);
    return null;
  }
}

/**
 * Extract video duration (in seconds) via ffprobe or Windows Shell COM
 */
async function extractDuration(filePath: string): Promise<number> {
  // 1. Try ffprobe (fastest, supports virtually all containers & codecs)
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 3000 }
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
      const raw = stdout.trim();
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
 * Extract video thumbnail frame via ffmpeg directly to buffer
 */
async function extractVideoFrameBuffer(filePath: string, duration: number): Promise<Buffer | null> {
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
      timeout: 4000
    });
    if (buf && buf.length > 0) return buf;
  } catch {}

  try {
    const cmd = `ffmpeg -ss 00:00:00.100 -i "${filePath}" -vframes 1 -vf "scale=360:-1" -f image2 -update 1 pipe:1`;
    const { stdout: buf } = await execAsync(cmd, {
      encoding: 'buffer',
      maxBuffer: 15 * 1024 * 1024,
      timeout: 3000
    });
    if (buf && buf.length > 0) return buf;
  } catch {}

  return null;
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

  /**
   * Universal Base64 Reader: Supports JPG, PNG, WEBP, GIF, SVG, BMP, AVIF, TIFF,
   * AND Camera RAW (.CR3, .CR2, .NEF, .ARW, .DNG, etc.) by extracting the embedded preview!
   */
  ipcMain.handle('media:readImageBase64', async (_event, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase().replace('.', '');

      // Camera RAW files: Extract high-resolution embedded preview
      if (RAW_EXTS.has(ext)) {
        const rawBuf = extractEmbeddedRawJpeg(filePath, false);
        if (rawBuf && rawBuf.length > 0) {
          return {
            ok: true,
            dataUrl: `data:image/jpeg;base64,${rawBuf.toString('base64')}`
          };
        }
      }

      const MIME_MAP: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        ico: 'image/x-icon',
        avif: 'image/avif',
        tiff: 'image/tiff',
        tif: 'image/tiff'
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
   * Fast native extraction of video/photo thumbnails & metadata with persistent disk caching.
   * Handles Camera RAW (.CR3, .CR2, .ARW, etc.), Videos (.MP4, .MKV, .MOV, etc.), and standard images.
   */
  ipcMain.handle('media:getVideoMetadata', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found', duration: 0, thumb: '' };
      }

      const stat = fs.statSync(filePath);
      const cacheKey = getCacheKey(filePath, stat);

      // 1. Check in-memory cache
      const memCached = memThumbCache.get(cacheKey);
      if (memCached) {
        return { ok: true, duration: memCached.duration || 0, thumb: memCached.thumb };
      }

      // 2. Check persistent disk cache
      const diskCacheFile = path.join(getThumbCacheDir(), `${cacheKey}.jpg`);
      const metaCacheFile = path.join(getThumbCacheDir(), `${cacheKey}.json`);

      if (fs.existsSync(diskCacheFile)) {
        try {
          const diskBuf = fs.readFileSync(diskCacheFile);
          let duration = 0;
          if (fs.existsSync(metaCacheFile)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaCacheFile, 'utf-8'));
              duration = meta.duration || 0;
            } catch {}
          }
          const dataUrl = `data:image/jpeg;base64,${diskBuf.toString('base64')}`;
          memThumbCache.set(cacheKey, { thumb: dataUrl, duration });
          return { ok: true, duration, thumb: dataUrl };
        } catch {}
      }

      const ext = path.extname(filePath).toLowerCase().replace('.', '');

      // 3. Camera RAW files (.CR3, .CR2, .NEF, .ARW, .DNG, etc.)
      if (RAW_EXTS.has(ext)) {
        const rawBuf = extractEmbeddedRawJpeg(filePath, true);
        if (rawBuf && rawBuf.length > 0) {
          try {
            fs.writeFileSync(diskCacheFile, rawBuf);
          } catch {}
          const dataUrl = `data:image/jpeg;base64,${rawBuf.toString('base64')}`;
          memThumbCache.set(cacheKey, { thumb: dataUrl, duration: 0 });
          return { ok: true, duration: 0, thumb: dataUrl };
        }
      }

      // 4. Video Files (.MP4, .MKV, .MOV, .AVI, etc.)
      const duration = await extractDuration(filePath);
      const frameBuf = await extractVideoFrameBuffer(filePath, duration);

      let thumb = '';
      if (frameBuf && frameBuf.length > 0) {
        try {
          fs.writeFileSync(diskCacheFile, frameBuf);
          fs.writeFileSync(metaCacheFile, JSON.stringify({ duration }));
        } catch {}
        thumb = `data:image/jpeg;base64,${frameBuf.toString('base64')}`;
      }

      const result = { duration, thumb };
      if (thumb || duration > 0) {
        memThumbCache.set(cacheKey, result);
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
