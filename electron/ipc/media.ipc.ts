import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

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
