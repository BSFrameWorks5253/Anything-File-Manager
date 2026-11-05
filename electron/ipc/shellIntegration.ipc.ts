import { ipcMain, app, shell } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const REG_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
const IE4UINIT_EXE = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'ie4uinit.exe');

async function runReg(args: string[], options?: any) {
  return execFileAsync(REG_EXE, args, { windowsHide: true, ...options });
}

// Windows Shell Thumbnail Provider CLSIDs
const WIN_VIDEO_THUMB_PROVIDER = '{c5aec3ec-e812-4677-a9a7-4fee1f9aa000}';
const WIN_PHOTO_THUMB_PROVIDER = '{C7657C4A-9F68-40fa-A4DF-96BC08EB3551}';
const WIN_PHOTO_EXTRACT_IMAGE = '{3F30C968-480A-4C6C-862D-EFC0897BB84B}';

const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mpg', '.mpeg', '.3gp'
];

const PHOTO_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.ico', '.avif', '.tiff', '.tif',
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.raw'
];

function getOpenCommand(): string {
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    return `"${process.execPath}" "%1"`;
  }
  // In development / non-packaged mode
  const electronExe = process.execPath;
  const mainJs = path.join(app.getAppPath(), 'dist-electron', 'main.js');
  return `"${electronExe}" "${mainJs}" "%1"`;
}

function getAppIconPath(): string {
  const iconCandidates = [
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(process.resourcesPath, 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'icon.ico'),
    process.execPath
  ];
  for (const p of iconCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return process.execPath;
}

export function registerShellIntegrationIPC(): void {
  /**
   * Registers MediaView Studio as the default viewer and shell thumbnail provider
   * in Windows Registry for selected categories ('videos' | 'photos')
   * Uses execFile with direct argument arrays to eliminate shell command injection risks.
   */
  ipcMain.handle('shell:registerDefaultViewer', async (event, categories: ('videos' | 'photos')[]) => {
    if (!event.senderFrame) {
      return { ok: false, error: 'Unauthorized sender' };
    }
    if (process.platform !== 'win32') {
      return { ok: true, message: 'Non-Windows system' };
    }
    if (!Array.isArray(categories)) {
      return { ok: false, error: 'Invalid categories argument' };
    }

    const openCmd = getOpenCommand();
    const iconPath = getAppIconPath();
    const results: { ext: string; ok: boolean; error?: string }[] = [];

    const extsToRegister: { ext: string; type: 'video' | 'photo' }[] = [];
    if (categories.includes('videos')) {
      for (const ext of VIDEO_EXTENSIONS) extsToRegister.push({ ext, type: 'video' });
    }
    if (categories.includes('photos')) {
      for (const ext of PHOTO_EXTENSIONS) extsToRegister.push({ ext, type: 'photo' });
    }

    try {
      // 1. Register Video ProgID
      if (categories.includes('videos')) {
        const vidProgId = 'MediaViewStudio.Video';
        await runReg(['add', `HKCU\\Software\\Classes\\${vidProgId}`, '/ve', '/d', 'MediaView Studio Video File', '/f']);
        await runReg(['add', `HKCU\\Software\\Classes\\${vidProgId}\\DefaultIcon`, '/ve', '/d', `"${iconPath}",0`, '/f']);
        await runReg(['add', `HKCU\\Software\\Classes\\${vidProgId}\\shell\\open\\command`, '/ve', '/d', openCmd, '/f']);
        // Bind Windows Shell Thumbnail Provider
        await runReg(['add', `HKCU\\Software\\Classes\\${vidProgId}\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}`, '/ve', '/d', WIN_VIDEO_THUMB_PROVIDER, '/f']);
        await runReg(['add', `HKCU\\Software\\Classes\\${vidProgId}\\ShellEx\\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}`, '/ve', '/d', WIN_VIDEO_THUMB_PROVIDER, '/f']);
      }

      // 2. Register Image ProgID
      if (categories.includes('photos')) {
        const imgProgId = 'MediaViewStudio.Image';
        await runReg(['add', `HKCU\\Software\\Classes\\${imgProgId}`, '/ve', '/d', 'MediaView Studio Image File', '/f']);
        await runReg(['add', `HKCU\\Software\\Classes\\${imgProgId}\\DefaultIcon`, '/ve', '/d', `"${iconPath}",0`, '/f']);
        await runReg(['add', `HKCU\\Software\\Classes\\${imgProgId}\\shell\\open\\command`, '/ve', '/d', openCmd, '/f']);
        // Bind Windows Shell Photo Thumbnail Provider
        await runReg(['add', `HKCU\\Software\\Classes\\${imgProgId}\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}`, '/ve', '/d', WIN_PHOTO_THUMB_PROVIDER, '/f']);
        await runReg(['add', `HKCU\\Software\\Classes\\${imgProgId}\\ShellEx\\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}`, '/ve', '/d', WIN_PHOTO_EXTRACT_IMAGE, '/f']);
      }

      // 3. Register each extension & its thumbnail handler
      for (const item of extsToRegister) {
        try {
          const progId = item.type === 'video' ? 'MediaViewStudio.Video' : 'MediaViewStudio.Image';
          const thumbProvider = item.type === 'video' ? WIN_VIDEO_THUMB_PROVIDER : WIN_PHOTO_THUMB_PROVIDER;
          const extractImage = item.type === 'video' ? WIN_VIDEO_THUMB_PROVIDER : WIN_PHOTO_EXTRACT_IMAGE;
          const mime = item.type === 'video' ? `video/${item.ext.replace('.', '')}` : `image/${item.ext.replace('.', '')}`;

          // Extension associations
          await runReg(['add', `HKCU\\Software\\Classes\\${item.ext}`, '/ve', '/d', progId, '/f']);
          await runReg(['add', `HKCU\\Software\\Classes\\${item.ext}`, '/v', 'PerceivedType', '/d', item.type, '/f']);
          await runReg(['add', `HKCU\\Software\\Classes\\${item.ext}`, '/v', 'Content Type', '/d', mime, '/f']);
          await runReg(['add', `HKCU\\Software\\Classes\\${item.ext}\\OpenWithProgids`, '/v', progId, '/d', '', '/f']);

          // Thumbnail Provider bindings on extension directly
          await runReg(['add', `HKCU\\Software\\Classes\\${item.ext}\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}`, '/ve', '/d', thumbProvider, '/f']);
          await runReg(['add', `HKCU\\Software\\Classes\\${item.ext}\\ShellEx\\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}`, '/ve', '/d', extractImage, '/f']);

          // Windows File Explorer FileExts OpenWithProgids
          await runReg(['add', `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${item.ext}\\OpenWithProgids`, '/v', progId, '/d', '', '/f']);

          results.push({ ext: item.ext, ok: true });
        } catch (e: any) {
          results.push({ ext: item.ext, ok: false, error: e.message });
        }
      }

      // 4. Register Capabilities for Windows Settings "Default Apps"
      await runReg(['add', 'HKCU\\Software\\MediaViewStudio\\Capabilities', '/v', 'ApplicationDescription', '/d', 'Universal Photo, Video & Media Asset Viewer for Anything Apps', '/f']);
      await runReg(['add', 'HKCU\\Software\\MediaViewStudio\\Capabilities', '/v', 'ApplicationName', '/d', 'MediaView Studio', '/f']);
      for (const item of extsToRegister) {
        const progId = item.type === 'video' ? 'MediaViewStudio.Video' : 'MediaViewStudio.Image';
        await runReg(['add', 'HKCU\\Software\\MediaViewStudio\\Capabilities\\FileAssociations', '/v', item.ext, '/d', progId, '/f']);
      }
      await runReg(['add', 'HKCU\\Software\\RegisteredApplications', '/v', 'MediaView Studio', '/d', 'Software\\MediaViewStudio\\Capabilities', '/f']);

      // 5. Tell Windows File Explorer to refresh thumbnail cache and file icon cache immediately
      try {
        if (fs.existsSync(IE4UINIT_EXE)) {
          await execFileAsync(IE4UINIT_EXE, ['-show'], { timeout: 3000 });
        }
      } catch {}

      return {
        ok: true,
        registeredCount: results.filter(r => r.ok).length,
        total: results.length,
        results
      };
    } catch (err: any) {
      console.error('[shell:registerDefaultViewer] Error:', err);
      return { ok: false, error: err.message };
    }
  });

  /**
   * Check which categories are currently registered to MediaView Studio
   */
  ipcMain.handle('shell:checkDefaultStatus', async (event) => {
    if (!event.senderFrame) return { isVideoDefault: false, isPhotoDefault: false };
    if (process.platform !== 'win32') {
      return { isVideoDefault: false, isPhotoDefault: false };
    }

    let isVideoDefault = false;
    let isPhotoDefault = false;

    try {
      const { stdout: vOut } = await runReg(['query', 'HKCU\\Software\\Classes\\.mp4', '/ve'], { timeout: 3000 });
      isVideoDefault = vOut.includes('MediaViewStudio.Video');
    } catch {}

    try {
      const { stdout: pOut } = await runReg(['query', 'HKCU\\Software\\Classes\\.jpg', '/ve'], { timeout: 3000 });
      isPhotoDefault = pOut.includes('MediaViewStudio.Image');
    } catch {}

    return { isVideoDefault, isPhotoDefault };
  });

  /**
   * Unregister custom associations and restore Windows defaults
   */
  ipcMain.handle('shell:unregisterDefaultViewer', async (event) => {
    if (!event.senderFrame) return { ok: false, error: 'Unauthorized sender' };
    if (process.platform !== 'win32') return { ok: true };

    try {
      const allExts = [...VIDEO_EXTENSIONS, ...PHOTO_EXTENSIONS];
      for (const ext of allExts) {
        try {
          await runReg(['delete', `HKCU\\Software\\Classes\\${ext}`, '/f']);
          await runReg(['delete', `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\OpenWithProgids`, '/v', 'MediaViewStudio.Video', '/f']);
          await runReg(['delete', `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\OpenWithProgids`, '/v', 'MediaViewStudio.Image', '/f']);
        } catch {}
      }

      try {
        await runReg(['delete', 'HKCU\\Software\\Classes\\MediaViewStudio.Video', '/f']);
        await runReg(['delete', 'HKCU\\Software\\Classes\\MediaViewStudio.Image', '/f']);
        await runReg(['delete', 'HKCU\\Software\\MediaViewStudio', '/f']);
        await runReg(['delete', 'HKCU\\Software\\RegisteredApplications', '/v', 'MediaView Studio', '/f']);
      } catch {}

      try {
        if (fs.existsSync(IE4UINIT_EXE)) {
          await execFileAsync(IE4UINIT_EXE, ['-show'], { timeout: 3000 });
        }
      } catch {}

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  /**
   * Launch Windows 10/11 Default Apps Settings page
   */
  ipcMain.handle('shell:openWindowsDefaultAppsSettings', async (event) => {
    if (!event.senderFrame) return false;
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:defaultapps');
      return true;
    }
    return false;
  });
}
