import { app, BrowserWindow, Menu, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerLocalResourceProtocol, handleLocalResourceProtocol } from './protocols/localResource';
import { registerMediaIPC } from './ipc/media.ipc';
import { resolveChildAppLoaderConfig, showChildAppSplash, closeChildAppSplash } from './splash/splash';

// Windows Taskbar & Action Center Model ID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.anything.mediaviewer');
}

// Windows High-DPI Support for crisp video and image rendering
app.commandLine.appendSwitch('high-dpi-support', '1');

// Register privileged local-resource protocol
registerLocalResourceProtocol();

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

// ── Register Modular Subsystem IPC Handlers ──────────────────
registerMediaIPC(() => mainWindow, () => initialFileToOpen);

// ── App Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  handleLocalResourceProtocol();

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
