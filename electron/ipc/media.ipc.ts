import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// File extension categories
const RAW_EXTS = new Set([
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'pef', 'sr2', 'srf'
]);

const VIDEO_EXTS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'm2ts', 'mts', 'mpg', 'mpeg', '3gp', 'vob', 'ogv',
  'braw', 'crm', 'r3d', 'ari', 'arx', 'cine', 'ts', 'tp', 'm2t', 'mod', 'tod', 'divx', 'dv', 'dif',
  'hevc', 'h264', 'h265', '264', '265', 'f4v', 'asf', 'mp4v', 'insv', 'lrf', 'lrv', 'dat',
  'm2v', 'm4p', 'nev', 'qt', 'rm', 'rmvb', 'vro', 'wtv', 'dvr-ms', 'ogm', 'mpe', 'mpv', 'm2p', '3g2', 'avchd'
]);

const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff', 'alac', 'mid', 'midi'
]);

// Well-known system hidden folders and files
const KNOWN_HIDDEN_NAMES = new Set([
  // Windows & OS system folders
  'system volume information',
  'recovery',
  'config.msi',
  'onedrivetemp',
  'perflogs',
  'documents and settings',
  'ahcache',
  'msocache',
  'programdata',
  'inteloptanedata',
  // Windows & OS system files
  'desktop.ini',
  'thumbs.db',
  'hiberfil.sys',
  'pagefile.sys',
  'swapfile.sys',
  'dumpstack.log.tmp',
  'boottel.dat'
]);

export function isItemHidden(name: string): boolean {
  if (!name) return false;
  // Dot files (.git, .GamingRoot, .DS_Store) & Dollar system folders ($Recycle.Bin, $SysReset)
  if (name.startsWith('.') || name.startsWith('$')) return true;
  const lower = name.toLowerCase();
  if (KNOWN_HIDDEN_NAMES.has(lower)) return true;
  if (/^found\.\d+$/i.test(name)) return true;
  if (lower.startsWith('ntuser.dat') || lower.startsWith('usrclass.dat')) return true;
  return false;
}

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

function findFfprobeBinary(): string {
  const candidates = [
    'C:\\Users\\Burhanuddin\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffprobe.exe',
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything Apps\\One Tap\\tools\\ffprobe.exe',
    path.join(process.cwd(), 'tools', 'ffprobe.exe'),
    path.join(app.getAppPath(), 'tools', 'ffprobe.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffprobe.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'resources', 'tools', 'ffprobe.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'tools', 'ffprobe.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffprobe';
}

function findFfmpegBinary(): string {
  const candidates = [
    'C:\\Users\\Burhanuddin\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe',
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything Apps\\One Tap\\tools\\ffmpeg.exe',
    path.join(process.cwd(), 'tools', 'ffmpeg.exe'),
    path.join(app.getAppPath(), 'tools', 'ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'resources', 'tools', 'ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'tools', 'ffmpeg.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

const memThumbCache = new Map<string, { thumb: string; duration?: number }>();

/**
 * Super-fast pure Node buffer extractor for embedded JPEGs inside Camera RAW files
 * (.CR3, .CR2, .NEF, .ARW, .DNG, .RAF, etc.)
 * Reads up to 4MB in ~2-15ms and extracts the embedded JPEG preview.
 */
function extractEmbeddedRawJpeg(filePath: string, forThumbnail = true): Buffer | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    // For thumbnails, 8MB captures all preview JPEGs; for full view, up to 16MB
    const READ_SIZE = forThumbnail ? 8 * 1024 * 1024 : 16 * 1024 * 1024;
    const buf = Buffer.alloc(READ_SIZE);
    const bytesRead = fs.readSync(fd, buf, 0, READ_SIZE, 0);

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
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

// Concurrency Limiter to prevent CPU starvation when extracting video frames
class ConcurrencyLimiter {
  private queue: (() => void)[] = [];
  private active = 0;
  constructor(private maxConcurrent = 2) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>(resolve => {
        this.queue.push(resolve);
      });
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const ffmpegLimiter = new ConcurrencyLimiter(2);

// Persistent Video Duration Disk Cache
let durationDiskCache: Record<string, number> | null = null;
let saveDurationTimer: NodeJS.Timeout | null = null;

function getDurationDiskCacheFile(): string {
  return path.join(app.getPath('userData'), 'video_duration_cache.json');
}

export function getCachedVideoDuration(cacheKey: string): number | undefined {
  if (!durationDiskCache) {
    try {
      const p = getDurationDiskCacheFile();
      if (fs.existsSync(p)) {
        durationDiskCache = JSON.parse(fs.readFileSync(p, 'utf8'));
      } else {
        durationDiskCache = {};
      }
    } catch {
      durationDiskCache = {};
    }
  }
  return durationDiskCache![cacheKey];
}

export function setCachedVideoDuration(cacheKey: string, dur: number): void {
  if (!durationDiskCache) durationDiskCache = {};
  durationDiskCache[cacheKey] = dur;
  if (!saveDurationTimer) {
    saveDurationTimer = setTimeout(() => {
      saveDurationTimer = null;
      try {
        fs.writeFileSync(getDurationDiskCacheFile(), JSON.stringify(durationDiskCache));
      } catch {}
    }, 2000);
  }
}

/**
 * Fast MP4/MOV header duration reader without spawning any child processes.
 * Reads first 128KB of file and extracts timescale & duration from 'mvhd' atom.
 * Executes in ~0.2 milliseconds.
 */
export function readFastMp4Duration(filePath: string): number | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(131072);
    const bytesRead = fs.readSync(fd, buf, 0, 131072, 0);
    const idx = buf.indexOf(Buffer.from('mvhd'));
    if (idx !== -1 && idx + 28 <= bytesRead) {
      const version = buf[idx + 4];
      let timescale = 0;
      let duration = 0;
      if (version === 0) {
        timescale = buf.readUInt32BE(idx + 16);
        duration = buf.readUInt32BE(idx + 20);
      } else if (version === 1) {
        timescale = buf.readUInt32BE(idx + 24);
        duration = Number(buf.readBigUInt64BE(idx + 28));
      }
      if (timescale > 0 && duration > 0) {
        return Math.round((duration / timescale) * 10) / 10;
      }
    }
  } catch {
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
  return null;
}

/**
 * Extract video duration (in seconds) via container atom or ffprobe
 */
export async function extractDuration(filePath: string): Promise<number> {
  try {
    const stat = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`;

    // 1. Check persistent disk cache
    const cached = getCachedVideoDuration(cacheKey);
    if (cached !== undefined && cached > 0) {
      return cached;
    }

    // 2. Instant container atom parsing for MP4/MOV (0.1ms)
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    if (['mp4', 'mov', 'm4v', 'mts', 'm2ts', 'qt'].includes(ext)) {
      const fastDur = readFastMp4Duration(filePath);
      if (fastDur && fastDur > 0) {
        setCachedVideoDuration(cacheKey, fastDur);
        return fastDur;
      }
    }

    // 3. Fallback: ffprobe
    const ffprobeBin = findFfprobeBinary();
    const { stdout } = await execFileAsync(
      ffprobeBin,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 3500 }
    );
    const parsed = parseFloat(stdout.trim());
    if (isFinite(parsed) && parsed > 0) {
      const val = Math.round(parsed * 10) / 10;
      setCachedVideoDuration(cacheKey, val);
      return val;
    }
  } catch {}
  return 0;
}

/**
 * Extract video thumbnail frame via ffmpeg directly to buffer with strict concurrency limit
 */
async function extractVideoFrameBuffer(filePath: string, duration: number): Promise<Buffer | null> {
  return ffmpegLimiter.run(async () => {
    let seekSecs = 0.5;
    if (duration > 1) {
      seekSecs = Math.min(Math.max(1, duration * 0.1), duration - 0.2);
    }
    const seekFormatted = new Date(seekSecs * 1000).toISOString().substr(11, 8) + '.' + String(Math.floor((seekSecs % 1) * 1000)).padStart(3, '0');

    try {
      const ffmpegBin = findFfmpegBinary();
      const { stdout: buf } = await execFileAsync(
        ffmpegBin,
        ['-ss', seekFormatted, '-i', filePath, '-vframes', '1', '-vf', 'scale=360:-1', '-f', 'image2', '-update', '1', 'pipe:1'],
        {
          encoding: 'buffer',
          maxBuffer: 15 * 1024 * 1024,
          timeout: 4000
        }
      );
      if (buf && buf.length > 0) return buf;
    } catch {}

    try {
      const ffmpegBin = findFfmpegBinary();
      const { stdout: buf } = await execFileAsync(
        ffmpegBin,
        ['-ss', '00:00:00.100', '-i', filePath, '-vframes', '1', '-vf', 'scale=360:-1', '-f', 'image2', '-update', '1', 'pipe:1'],
        {
          encoding: 'buffer',
          maxBuffer: 15 * 1024 * 1024,
          timeout: 3000
        }
      );
      if (buf && buf.length > 0) return buf;
    } catch {}

    return null;
  });
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
          let isDir = e.isDirectory();
          let size = 0,
            mtime = 0;
          let childCount: number | undefined;

          try {
            const stat = fs.statSync(fullPath);
            isDir = stat.isDirectory();
            size = stat.size;
            mtime = stat.mtimeMs;
          } catch {}

          if (isDir) {
            try {
              const children = fs.readdirSync(fullPath);
              childCount = children.length;
            } catch {
              childCount = 0;
            }
          }

          const ext = isDir ? '' : (e.name.split('.').pop() || '').toLowerCase();
          const isHidden = isItemHidden(e.name);
          return {
            name: e.name,
            isDir,
            size,
            mtime,
            ext,
            fullPath,
            isHidden,
            childCount
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
   * Universal Base64 Reader: Supports all Photos, Camera RAW, Videos, Audio, PDFs, and Documents
   */
  ipcMain.handle('media:readImageBase64', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found' };
      }

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

      if (MIME_MAP[ext]) {
        const buf = fs.readFileSync(filePath);
        return {
          ok: true,
          dataUrl: `data:${MIME_MAP[ext]};base64,${buf.toString('base64')}`
        };
      }

      // Check if we have a generated thumbnail preview in disk cache
      const stat = fs.statSync(filePath);
      const cacheKey = getCacheKey(filePath, stat);
      const diskCacheFile = path.join(getThumbCacheDir(), `${cacheKey}.jpg`);
      if (fs.existsSync(diskCacheFile)) {
        const diskBuf = fs.readFileSync(diskCacheFile);
        return {
          ok: true,
          dataUrl: `data:image/jpeg;base64,${diskBuf.toString('base64')}`
        };
      }

      // Fallback: Extract native Windows OS Shell Icon (256x256)
      const icon = await app.getFileIcon(filePath, { size: 'large' });
      return {
        ok: true,
        dataUrl: icon.toDataURL()
      };
    } catch (err: any) {
      return { ok: false, error: err.message ?? String(err) };
    }
  });

  /**
   * Fast Text & Code Reader for Universal Quick Look Preview
   */
  ipcMain.handle('media:readTextFile', async (_event, filePath: string, maxBytes = 512 * 1024) => {
    let fd: number | null = null;
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File not found' };
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) return { ok: false, error: 'Target is a directory' };

      const readSize = Math.min(stat.size, maxBytes);
      const buf = Buffer.alloc(readSize);
      fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, readSize, 0);

      const content = buf.toString('utf-8');
      const isTruncated = stat.size > maxBytes;
      const lineCount = content.split('\n').length;

      return {
        ok: true,
        content,
        lineCount,
        isTruncated,
        totalBytes: stat.size
      };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch {}
      }
    }
  });

  /**
   * Fast Video Duration lookup (uses MP4 header atom in 0.1ms or disk cache)
   */
  ipcMain.handle('media:getVideoDuration', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return 0;
      return await extractDuration(filePath);
    } catch {
      return 0;
    }
  });

  /**
   * Fast Universal Thumbnail & Metadata Extractor for ALL files with persistent disk caching.
   * Supports:
   * 1. Photos & Camera RAW (.CR3, .CR2, .NEF, .ARW, .DNG, etc.)
   * 2. Videos (.MP4, .MKV, .MOV, .AVI, .WEBM, .TS, etc.) + frame thumbnails + timelapse
   * 3. Audio (.MP3, .FLAC, .M4A, .WAV, etc.) + embedded album art + duration
   * 4. Documents & PDFs (.PDF, .DOCX, .PPTX, .XLSX)
   * 5. Universal Windows Shell 256x256 Thumbnails & Icons for ALL file types (.EXE, .ZIP, .TXT, .CODE, etc.)
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

      // 2.5 Folders / Directories: Extract authentic native OS folder icon
      if (stat.isDirectory()) {
        try {
          const icon = await app.getFileIcon(filePath, { size: 'large' });
          const folderThumb = icon.toDataURL();
          memThumbCache.set(cacheKey, { thumb: folderThumb, duration: 0 });
          return { ok: true, duration: 0, thumb: folderThumb };
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
      if (VIDEO_EXTS.has(ext)) {
        const duration = await extractDuration(filePath);
        const frameBuf = await extractVideoFrameBuffer(filePath, duration);

        let thumb = '';
        if (frameBuf && frameBuf.length > 0) {
          try {
            fs.writeFileSync(diskCacheFile, frameBuf);
            fs.writeFileSync(metaCacheFile, JSON.stringify({ duration }));
          } catch {}
          thumb = `data:image/jpeg;base64,${frameBuf.toString('base64')}`;
        } else {
          // Fallback to native Windows media file icon if ffmpeg didn't produce a frame
          try {
            const icon = await app.getFileIcon(filePath, { size: 'large' });
            thumb = icon.toDataURL();
          } catch {}
        }

        const result = { duration, thumb };
        if (thumb || duration > 0) {
          memThumbCache.set(cacheKey, result);
        }
        return { ok: true, duration, thumb };
      }

      // 5. Audio Files (.MP3, .FLAC, .M4A, .AAC, .OGG, .WAV, etc.)
      if (AUDIO_EXTS.has(ext)) {
        const duration = await extractDuration(filePath);
        let thumb = '';

        // Extract embedded album art via ffmpeg
        try {
          const ffmpegBin = findFfmpegBinary();
          const { stdout: artBuf } = await execFileAsync(
            ffmpegBin,
            ['-ss', '0', '-i', filePath, '-vframes', '1', '-vf', 'scale=360:-1', '-f', 'image2', '-update', '1', 'pipe:1'],
            { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 3500 }
          );
          if (artBuf && artBuf.length > 0) {
            thumb = `data:image/jpeg;base64,${artBuf.toString('base64')}`;
            try {
              fs.writeFileSync(diskCacheFile, artBuf);
              fs.writeFileSync(metaCacheFile, JSON.stringify({ duration }));
            } catch {}
          }
        } catch {}

        if (!thumb) {
          // If no album art, extract high-res Windows audio shell icon
          try {
            const icon = await app.getFileIcon(filePath, { size: 'large' });
            thumb = icon.toDataURL();
          } catch {}
        }

        const result = { duration, thumb };
        if (thumb || duration > 0) memThumbCache.set(cacheKey, result);
        return { ok: true, duration, thumb };
      }

      // 6. PDF Documents (.PDF)
      if (ext === 'pdf') {
        let thumb = '';
        try {
          const ffmpegBin = findFfmpegBinary();
          const { stdout: pdfBuf } = await execFileAsync(
            ffmpegBin,
            ['-i', filePath, '-vframes', '1', '-vf', 'scale=360:-1', '-f', 'image2', 'pipe:1'],
            { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 4000 }
          );
          if (pdfBuf && pdfBuf.length > 0) {
            thumb = `data:image/jpeg;base64,${pdfBuf.toString('base64')}`;
            try { fs.writeFileSync(diskCacheFile, pdfBuf); } catch {}
          }
        } catch {}

        if (!thumb) {
          try {
            const icon = await app.getFileIcon(filePath, { size: 'large' });
            thumb = icon.toDataURL();
          } catch {}
        }

        const result = { duration: 0, thumb };
        if (thumb) memThumbCache.set(cacheKey, result);
        return { ok: true, duration: 0, thumb };
      }

      // 7. Universal High-Res Windows Shell Thumbnail & Icon for ALL other file extensions
      // (.DOCX, .XLSX, .PPTX, .ZIP, .RAR, .7Z, .EXE, .TXT, .JS, .PY, .JSON, .HTML, etc.)
      let shellThumb = '';
      try {
        const icon = await app.getFileIcon(filePath, { size: 'large' });
        shellThumb = icon.toDataURL();
        if (shellThumb) {
          const rawBase64 = shellThumb.replace(/^data:image\/[a-z]+;base64,/, '');
          try {
            fs.writeFileSync(diskCacheFile, Buffer.from(rawBase64, 'base64'));
          } catch {}
        }
      } catch {}

      const result = { duration: 0, thumb: shellThumb };
      if (shellThumb) memThumbCache.set(cacheKey, result);
      return { ok: true, duration: 0, thumb: shellThumb };
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL CRUD FILE ENGINE (CROSS-DISK SUPPORT, RECYCLE BIN, DUPLICATION)
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Create New Folder
  ipcMain.handle('media:createFolder', async (_event, parentDir: string, customName?: string) => {
    try {
      if (!parentDir || !fs.existsSync(parentDir)) {
        return { ok: false, error: 'Parent directory does not exist' };
      }
      let folderName = customName?.trim() || 'New folder';
      let targetPath = path.join(parentDir, folderName);
      let count = 2;
      while (fs.existsSync(targetPath)) {
        targetPath = path.join(parentDir, `${folderName} (${count})`);
        count++;
      }
      fs.mkdirSync(targetPath, { recursive: true });
      return { ok: true, path: targetPath, name: path.basename(targetPath) };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  // 2. Create New Text / Code / Note File
  ipcMain.handle('media:createFile', async (_event, parentDir: string, fileName?: string, defaultContent = '') => {
    try {
      if (!parentDir || !fs.existsSync(parentDir)) {
        return { ok: false, error: 'Parent directory does not exist' };
      }
      let baseName = fileName?.trim() || 'New Document.txt';
      let targetPath = path.join(parentDir, baseName);
      const ext = path.extname(baseName);
      const root = path.basename(baseName, ext);
      let count = 2;
      while (fs.existsSync(targetPath)) {
        targetPath = path.join(parentDir, `${root} (${count})${ext}`);
        count++;
      }
      fs.writeFileSync(targetPath, defaultContent, 'utf-8');
      return { ok: true, path: targetPath, name: path.basename(targetPath) };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

function isRootOrSystemPath(p: string): boolean {
  if (!p || typeof p !== 'string') return true;
  try {
    const resolved = path.resolve(p);
    const parsed = path.parse(resolved);
    // Root drive e.g. "C:\", "D:\", "/"
    if (resolved.toLowerCase() === parsed.root.toLowerCase()) return true;

    const lower = resolved.toLowerCase();
    const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
    if (lower === winDir || lower.startsWith(winDir + path.sep)) return true;

    const progFiles = (process.env.ProgramFiles || 'C:\\Program Files').toLowerCase();
    if (lower === progFiles || lower.startsWith(progFiles + path.sep)) return true;

    const progFilesX86 = (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase();
    if (lower === progFilesX86 || lower.startsWith(progFilesX86 + path.sep)) return true;
  } catch {
    return true;
  }
  return false;
}

  // 3. Rename File or Folder
  ipcMain.handle('media:renameItem', async (_event, oldPath: string, newName: string) => {
    try {
      if (!oldPath || !fs.existsSync(oldPath)) {
        return { ok: false, error: 'Original item not found' };
      }
      if (isRootOrSystemPath(oldPath)) {
        return { ok: false, error: 'Cannot rename protected root or system location' };
      }
      const trimmed = newName?.trim();
      if (!trimmed) return { ok: false, error: 'Filename cannot be empty' };

      // Validate invalid Windows / OS filename characters
      if (/[<>:"/\\|?*]/.test(trimmed)) {
        return { ok: false, error: 'A filename cannot contain \\ / : * ? " < > |' };
      }

      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, trimmed);

      // Handle case-only renaming on Windows (e.g. photo.jpg -> Photo.jpg)
      const isCaseOnlyChange = newPath.toLowerCase() === oldPath.toLowerCase() && newPath !== oldPath;
      if (!isCaseOnlyChange && fs.existsSync(newPath)) {
        return { ok: false, error: `An item named "${trimmed}" already exists.` };
      }

      if (isCaseOnlyChange) {
        // Windows NTFS requires renaming through a temp name when only the case changes
        const tempPath = path.join(dir, `__afm_tmp_${Date.now()}_${trimmed}`);
        fs.renameSync(oldPath, tempPath);
        fs.renameSync(tempPath, newPath);
      } else {
        fs.renameSync(oldPath, newPath);
      }
      return { ok: true, newPath, name: trimmed };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  // 4. Delete Items (Native Recycle Bin / Trash or Permanent)
  ipcMain.handle('media:deleteItems', async (_event, filePaths: string[], permanent = false) => {
    let deletedCount = 0;
    const errors: string[] = [];

    for (const p of filePaths) {
      try {
        if (!p || typeof p !== 'string' || !fs.existsSync(p)) continue;
        if (isRootOrSystemPath(p)) {
          errors.push(`Cannot delete protected root or system location: ${p}`);
          continue;
        }
        if (permanent) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          // Send to native OS Recycle Bin / Trash
          await shell.trashItem(p);
        }
        deletedCount++;
      } catch (err: any) {
        errors.push(`${path.basename(p)}: ${err.message || String(err)}`);
      }
    }

    return {
      ok: errors.length === 0,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  });

  // 5. Cross-Disk File Clipboard Engine (Copy & Move across different drives)
  ipcMain.handle('media:clipboardPaste', async (_event, targetDir: string, sourcePaths: string[], operation: 'copy' | 'move') => {
    try {
      if (!targetDir || !fs.existsSync(targetDir)) {
        return { ok: false, error: 'Target directory not found', pastedCount: 0 };
      }
      let pastedCount = 0;
      const errors: string[] = [];

      for (const src of sourcePaths) {
        try {
          if (!src || !fs.existsSync(src)) continue;

          // Prevent pasting a folder into itself or its own subfolder (infinite recursion guard)
          const resolvedSrc = path.resolve(src);
          const resolvedTarget = path.resolve(targetDir);
          if (
            resolvedTarget.toLowerCase() === resolvedSrc.toLowerCase() ||
            resolvedTarget.toLowerCase().startsWith(resolvedSrc.toLowerCase() + path.sep)
          ) {
            errors.push(`Cannot copy or move "${path.basename(src)}" into itself or its subfolder.`);
            continue;
          }

          if (operation === 'move' && isRootOrSystemPath(src)) {
            errors.push(`Cannot move protected system location: ${src}`);
            continue;
          }

          const originalName = path.basename(src);
          const ext = path.extname(originalName);
          const base = path.basename(originalName, ext);

          // Calculate destination path with collision handling
          let dst = path.join(targetDir, originalName);
          if (fs.existsSync(dst)) {
            let counter = 2;
            const prefix = operation === 'copy' && path.dirname(src) === targetDir ? ' - Copy' : '';
            dst = path.join(targetDir, `${base}${prefix}${ext}`);
            while (fs.existsSync(dst)) {
              dst = path.join(targetDir, `${base}${prefix} (${counter})${ext}`);
              counter++;
            }
          }

          if (operation === 'copy') {
            fs.cpSync(src, dst, { recursive: true });
          } else {
            // Move: check if same filesystem or cross-disk (EXDEV)
            try {
              fs.renameSync(src, dst);
            } catch (renameErr: any) {
              if (renameErr.code === 'EXDEV' || renameErr.code === 'EPERM' || renameErr.code === 'EACCES') {
                // Cross-disk move (e.g. C: to D:): copy then remove source
                fs.cpSync(src, dst, { recursive: true });
                fs.rmSync(src, { recursive: true, force: true });
              } else {
                throw renameErr;
              }
            }
          }
          pastedCount++;
        } catch (itemErr: any) {
          errors.push(`${path.basename(src)}: ${itemErr.message || String(itemErr)}`);
        }
      }

      return {
        ok: errors.length === 0,
        pastedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err), pastedCount: 0 };
    }
  });

  // 6. Duplicate File / Folder (macOS Cmd+D style)
  ipcMain.handle('media:duplicateItem', async (_event, sourcePath: string) => {
    try {
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return { ok: false, error: 'Source item does not exist' };
      }
      const dir = path.dirname(sourcePath);
      const originalName = path.basename(sourcePath);
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext);

      let candidate = path.join(dir, `${base} - Copy${ext}`);
      let counter = 2;
      while (fs.existsSync(candidate)) {
        candidate = path.join(dir, `${base} - Copy (${counter})${ext}`);
        counter++;
      }

      fs.cpSync(sourcePath, candidate, { recursive: true });
      return { ok: true, newPath: candidate, name: path.basename(candidate) };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  // 7. Apple macOS Style Color Tags
  const getTagsFilePath = () => path.join(app.getPath('userData'), 'file-color-tags.json');
  ipcMain.handle('media:getFileTags', async () => {
    try {
      const p = getTagsFilePath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch {}
    return {};
  });

  ipcMain.handle('media:setFileTag', async (_event, filePath: string, tagColor: string | null) => {
    try {
      const p = getTagsFilePath();
      let map: Record<string, string> = {};
      if (fs.existsSync(p)) {
        try { map = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
      }
      if (tagColor) {
        map[filePath] = tagColor;
      } else {
        delete map[filePath];
      }
      fs.writeFileSync(p, JSON.stringify(map, null, 2), 'utf-8');
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('media:getItemsByPaths', async (_event, filePaths: string[]) => {
    const results: any[] = [];
    for (const fp of filePaths) {
      try {
        if (!fs.existsSync(fp)) continue;
        const stat = fs.statSync(fp);
        const isDir = stat.isDirectory();
        let childCount: number | undefined = undefined;
        if (isDir) {
          try {
            childCount = fs.readdirSync(fp).length;
          } catch {}
        }
        const parsed = path.parse(fp);
        results.push({
          name: parsed.base || fp,
          fullPath: fp,
          isDir,
          size: stat.size,
          mtime: stat.mtimeMs,
          ext: isDir ? '' : parsed.ext.replace(/^\./, '').toLowerCase(),
          isHidden: parsed.base.startsWith('.'),
          childCount
        });
      } catch (err) {
        console.warn('[AFM getItemsByPaths] stat error for:', fp, err);
      }
    }
    return results;
  });
}
