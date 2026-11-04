import { app, BrowserWindow, Menu, nativeTheme, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerLocalResourceProtocol, handleLocalResourceProtocol } from './protocols/localResource';
import { registerMediaIPC } from './ipc/media.ipc';
import { registerShellIntegrationIPC } from './ipc/shellIntegration.ipc';
import { registerAfmIPC } from './ipc/afm.ipc';
import { resolveChildAppLoaderConfig, showChildAppSplash, closeChildAppSplash } from './splash/splash';

// Windows Taskbar & Action Center Model ID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.anything.filemanager');
}

// Windows High-DPI Support for crisp video and image rendering
app.commandLine.appendSwitch('high-dpi-support', '1');

// Register privileged local-resource protocol
registerLocalResourceProtocol();

const isDev = process.env.NODE_ENV === 'development' && !!process.env.VITE_DEV_SERVER_URL;

try {
  const appDataRoot = app.getPath('appData');
  const targetUserData = path.join(appDataRoot, isDev ? 'AnythingFileManager_Dev' : 'AnythingFileManager');
  app.setPath('userData', targetUserData);
} catch (err) {
  console.warn('[AnythingFileManager] Warning setting userData path:', err);
}

let mainWindow: BrowserWindow | null = null;
let splashCompleted = false;
let isMainWindowReady = false;
let initialFileToOpen: string | null = null;

// Parse file passed in CLI arguments (e.g. Explorer double click or "anything-file-manager.exe photo.jpg")
const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.ico', '.tiff', '.tif',
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf',
  '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mpg'
]);

function extractMediaFromArgv(argv: string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i];
    if (arg.startsWith('--')) continue;
    const clean = arg.replace(/^["']|["']$/g, '');
    try {
      if (fs.existsSync(clean)) {
        return clean;
      }
    } catch {}
    const lower = clean.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot !== -1 && MEDIA_EXTS.has(lower.slice(dot))) {
      return clean;
    }
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

function getAppIconPath(state: 'open' | 'closed' = 'open'): string {
  const ext = process.platform === 'win32' ? 'ico' : 'png';
  const fileName = state === 'open' ? `icon-open.${ext}` : `icon-closed.${ext}`;
  const fallbackIco = `icon.${ext}`;
  const candidates = [
    path.join(__dirname, '../build', fileName),
    path.join(__dirname, '../../build', fileName),
    path.join(process.cwd(), 'build', fileName),
    path.join(app.getAppPath(), 'build', fileName),
    path.join(__dirname, '../build', fallbackIco),
    path.join(__dirname, '../build', 'icon-open.png'),
    path.join(__dirname, '../build', 'icon.png')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, '../build/icon.png');
}

function createWindow(showImmediately = false) {
  const openIcon = getAppIconPath('open');
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1024,
    minHeight: 680,
    title: 'Anything File Manager',
    icon: openIcon,
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

  // Dynamic Taskbar Icon state management:
  // Running / active: folder is OPEN with file revealed
  // Minimized: folder rests in CLOSED state
  mainWindow.on('minimize', () => {
    const closedIcon = getAppIconPath('closed');
    if (fs.existsSync(closedIcon) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(closedIcon);
    }
  });
  mainWindow.on('restore', () => {
    const activeOpenIcon = getAppIconPath('open');
    if (fs.existsSync(activeOpenIcon) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(activeOpenIcon);
    }
  });
  mainWindow.on('focus', () => {
    const activeOpenIcon = getAppIconPath('open');
    if (fs.existsSync(activeOpenIcon) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(activeOpenIcon);
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
    isMainWindowReady = true;
    if (splashCompleted && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    isMainWindowReady = true;
    if (splashCompleted && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (initialFileToOpen && mainWindow) {
      setTimeout(() => {
        mainWindow?.webContents.send('media:openTarget', initialFileToOpen);
      }, 500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Security Hardening: Prevent untrusted window creation and navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowedDev = isDev && (
      url.startsWith('http://localhost:') ||
      url.startsWith('http://127.0.0.1:') ||
      (process.env.VITE_DEV_SERVER_URL ? url.startsWith(process.env.VITE_DEV_SERVER_URL) : false)
    );
    const isAllowedFile = url.startsWith('file://');
    if (!isAllowedDev && !isAllowedFile) {
      event.preventDefault();
      if (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('mailto:')) {
        shell.openExternal(url);
      }
    }
  });
}

// ── Register Modular Subsystem IPC Handlers ──────────────────
registerMediaIPC(() => mainWindow, () => initialFileToOpen);
registerShellIntegrationIPC();
registerAfmIPC();

// ── App Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('anything.file.manager');
  }

  handleLocalResourceProtocol();

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('media:openSeparatePlayer', async (_event, filePath: string) => {
    const fileName = path.basename(filePath);
    const playerWin = new BrowserWindow({
      width: 1120,
      height: 740,
      minWidth: 640,
      minHeight: 460,
      title: `${fileName} — Anything Media Player`,
      icon: getAppIconPath('open'),
      backgroundColor: '#07080b',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    Menu.setApplicationMenu(null);
    playerWin.setMenuBarVisibility(false);

    playerWin.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    playerWin.webContents.on('will-navigate', (event, url) => {
      const isAllowedDev = isDev && (
        url.startsWith('http://localhost:') ||
        url.startsWith('http://127.0.0.1:') ||
        (process.env.VITE_DEV_SERVER_URL ? url.startsWith(process.env.VITE_DEV_SERVER_URL) : false)
      );
      const isAllowedFile = url.startsWith('file://');
      if (!isAllowedDev && !isAllowedFile) {
        event.preventDefault();
      }
    });

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (isDev && devServerUrl) {
      playerWin.loadURL(`${devServerUrl}?player=1&file=${encodeURIComponent(filePath)}`);
    } else {
      playerWin.loadFile(getAppIndexPath(), {
        query: { player: '1', file: filePath }
      });
    }
    return { ok: true };
  });

  const loaderConfig = resolveChildAppLoaderConfig('anything-file-manager', 'Anything File Manager');

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
