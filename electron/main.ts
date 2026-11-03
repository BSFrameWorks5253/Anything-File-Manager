import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { resolveChildAppLoaderConfig, showChildAppSplash, closeChildAppSplash, ChildAppLoaderConfig } from './splash';

// Windows Taskbar & Action Center Model ID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.anything.mediaviewer');
}

// Windows High-DPI Support for crisp video and image rendering
app.commandLine.appendSwitch('high-dpi-support', '1');

// Register privileged local-resource protocol for high-bitrate video streaming & images
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-resource',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
      corsEnabled: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let splashCompleted = false;
let initialFileToOpen: string | null = null;

// Parse file passed in CLI arguments (e.g. Explorer double click or "mediaviewer.exe photo.jpg")
const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.ico', '.tiff', '.tif',
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf',
  '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mpg'
]);

function extractMediaFromArgv(argv: string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i];
    if (arg.startsWith('--')) continue;
    const lower = arg.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot !== -1 && MEDIA_EXTS.has(lower.slice(dot))) {
      return arg.replace(/^["']|["']$/g, '');
    }
    // Also check if directory
    try {
      if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) {
        return arg;
      }
    } catch {}
  }
  return null;
}

initialFileToOpen = extractMediaFromArgv(process.argv);

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', (_event, argv) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    const file = extractMediaFromArgv(argv);
    if (file) {
      mainWindow.webContents.send('media:openTarget', file);
    }
  }
});

const isDev = process.env.NODE_ENV === 'development' && !!process.env.VITE_DEV_SERVER_URL;

try {
  const appDataRoot = app.getPath('appData');
  const targetUserData = path.join(appDataRoot, isDev ? 'MediaViewStudio_Dev' : 'MediaViewStudio');
  app.setPath('userData', targetUserData);
} catch (err) {
  console.warn('[MediaViewStudio] Warning setting userData path:', err);
}

function getAppIndexPath(): string {
  const candidates = [
    path.join(__dirname, '../dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
    path.join(app.getAppPath(), 'index.html'),
    path.join(process.resourcesPath, 'app.asar/dist/index.html')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function createWindow(showImmediately = false) {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1024,
    minHeight: 680,
    title: 'MediaView Studio — Universal Media Asset Viewer',
    backgroundColor: '#0c0d12',
    darkTheme: true,
    autoHideMenuBar: true,
    show: showImmediately,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.warn('[MediaViewStudio] Falling back to dist/index.html:', err);
      mainWindow?.loadFile(getAppIndexPath());
    });
  } else {
    mainWindow.loadFile(getAppIndexPath()).catch(console.error);
  }

  mainWindow.once('ready-to-show', () => {
    if (splashCompleted) {
      mainWindow?.show();
    }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (initialFileToOpen && mainWindow) {
      setTimeout(() => {
        mainWindow?.webContents.send('media:openTarget', initialFileToOpen);
      }, 500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ──────────────────────────────────────────────
ipcMain.handle('media:listDir', async (_event, dirPath: string) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => {
      const fullPath = path.join(dirPath, e.name);
      let size = 0, mtime = 0;
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
    }).sort((a, b) => {
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

ipcMain.handle('media:selectFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder to Browse Media'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('media:saveSnapshot', async (_event, dataUrl: string, defaultName: string) => {
  if (!mainWindow) return { ok: false };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Frame Snapshot',
    defaultPath: path.join(app.getPath('pictures') || app.getPath('desktop'), defaultName || `snapshot_${Date.now()}.jpg`),
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

ipcMain.handle('media:getInitialFile', async () => initialFileToOpen);

// ── App Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  // Setup streaming local-resource protocol
  protocol.handle('local-resource', async (request) => {
    try {
      let cleanUrl = request.url.replace(/^local-resource:\/\/?\/?/i, '');
      let rawPath = decodeURIComponent(cleanUrl);
      if (/^\/?[a-zA-Z]:[\\\/]/.test(rawPath)) {
        rawPath = rawPath.replace(/^\//, '');
      }
      rawPath = rawPath.replace(/\//g, '\\');

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 });
      }

      const ext = path.extname(rawPath).toLowerCase();
      const MIME: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
        '.ts': 'video/mp2t', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv'
      };
      const contentType = MIME[ext] || 'application/octet-stream';

      const fileStat = fs.statSync(rawPath);
      const fileSize = fileStat.size;

      // Range support for seamless video seeking
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024 * 2, fileSize - 1);
          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(rawPath, { start, end });
          const webStream = new ReadableStream({
            start(controller) {
              stream.on('data', chunk => controller.enqueue(chunk));
              stream.on('end', () => controller.close());
              stream.on('error', e => controller.error(e));
            },
            cancel() { stream.destroy(); }
          });
          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      const buf = fs.readFileSync(rawPath);
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buf.length),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch {
      return new Response('Error loading resource', { status: 500 });
    }
  });

  // Resolve dynamic loader configuration & trigger luxury splash
  const loaderConfig = resolveChildAppLoaderConfig('media-viewer', 'MediaView Studio');

  if (loaderConfig.enabled !== false) {
    createWindow(false);
    showChildAppSplash(loaderConfig, () => {
      splashCompleted = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } else {
    splashCompleted = true;
    createWindow(true);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
