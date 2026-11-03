import fs from 'fs';
import path from 'path';
import os from 'os';
import { app, BrowserWindow, screen } from 'electron';

export interface ChildAppLoaderConfig {
  appId: string;
  enabled?: boolean;
  artworkUrl?: string;
  productName?: string;
  versionText?: string;
  tagline?: string;
  artistName?: string;
  artworkTitle?: string;
  durationMs?: number;
  logoText?: string;
  badgeGradient?: string;
  artworkFit?: 'cover' | 'contain';
  artworkPosition?: string;
  author?: string;
  contactPhone?: string;
}

let splashWindow: BrowserWindow | null = null;
let splashTimer: NodeJS.Timeout | null = null;

export function resolveChildAppLoaderConfig(
  appId = 'media-viewer',
  fallbackAppName = 'MediaView Studio'
): ChildAppLoaderConfig {
  const defaultFallback: ChildAppLoaderConfig = {
    appId,
    enabled: true,
    productName: fallbackAppName,
    versionText: `v${app && typeof app.getVersion === 'function' ? app.getVersion() : '1.0.0'}`,
    tagline: 'Universal Photo & Video Studio with Frame Zoom & Timelapse Inspector',
    artistName: 'Anything Creative Ecosystem',
    artworkTitle: 'Master Media Viewing Edition',
    durationMs: 2200,
    logoText: 'MV',
    badgeGradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
    artworkUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1400&q=85',
    artworkFit: 'cover',
    artworkPosition: 'center',
    author: 'Burhanuddin Sounasath',
    contactPhone: '8369811201'
  };

  const readJson = (p: string): Partial<ChildAppLoaderConfig> | null => {
    try {
      if (p && fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '').trim();
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // non-fatal
    }
    return null;
  };

  // 1. CLI Argument
  for (const arg of process.argv || []) {
    if (arg.startsWith('--loader-config=')) {
      const cfgPath = arg.replace('--loader-config=', '').replace(/^["']|["']$/g, '');
      const parsed = readJson(cfgPath);
      if (parsed) return { ...defaultFallback, ...parsed };
    }
  }

  // 2. Global Anything Ecosystem loaders folder
  const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : '');
  const candidateGlobalPaths = [
    path.join(appData, 'Anything', 'loaders', `${appId}.json`),
    path.join(appData, 'anything', 'loaders', `${appId}.json`)
  ];
  for (const p of candidateGlobalPaths) {
    const parsed = readJson(p);
    if (parsed) return { ...defaultFallback, ...parsed };
  }

  // 3. Application Local loader-config.json
  const candidateLocalPaths = [
    path.join(process.cwd(), 'loader-config.json'),
    path.join(__dirname, '..', 'loader-config.json'),
    path.join(app.getAppPath(), 'loader-config.json')
  ];
  for (const p of candidateLocalPaths) {
    const parsed = readJson(p);
    if (parsed) return { ...defaultFallback, ...parsed };
  }

  return defaultFallback;
}

export function showChildAppSplash(config: ChildAppLoaderConfig, onFinished: () => void): void {
  if (config.enabled === false) {
    onFinished();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const SPLASH_WIDTH = 720;
  const SPLASH_HEIGHT = 440;

  splashWindow = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    x: Math.round((screenWidth - SPLASH_WIDTH) / 2),
    y: Math.round((screenHeight - SPLASH_HEIGHT) / 2),
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#0c0d12',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
      body {
        width: 100vw; height: 100vh;
        background: #0c0d12;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex; flex-direction: column;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
        overflow: hidden;
        border-radius: 14px;
      }
      .hero {
        position: relative;
        flex: 1;
        overflow: hidden;
        background: radial-gradient(circle at 70% 30%, #1e1b4b 0%, #0c0d12 70%);
      }
      .bg-art {
        position: absolute; inset: 0;
        background-image: url('${config.artworkUrl || ''}');
        background-size: ${config.artworkFit || 'cover'};
        background-position: ${config.artworkPosition || 'center'};
        opacity: 0.35;
        filter: blur(1px);
      }
      .overlay {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(12,13,18,0.2) 0%, rgba(12,13,18,0.85) 85%, #0c0d12 100%);
      }
      .content {
        position: relative; z-index: 2;
        padding: 36px 40px;
        display: flex; flex-direction: column; justify-content: flex-end;
        height: 100%;
      }
      .badge-row {
        display: flex; align-items: center; gap: 14px; margin-bottom: 12px;
      }
      .badge {
        width: 48px; height: 48px; border-radius: 12px;
        background: ${config.badgeGradient || 'linear-gradient(135deg, #6366f1, #ec4899)'};
        display: flex; align-items: center; justify-content: center;
        font-weight: 900; font-size: 20px; color: #fff;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
      }
      .title-group h1 {
        font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;
      }
      .title-group .version {
        font-size: 11px; font-weight: 600; color: #818cf8; text-transform: uppercase; letter-spacing: 0.08em;
      }
      .tagline {
        font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-bottom: 24px; max-width: 540px; line-height: 1.4;
      }
      .footer-row {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 11px; color: rgba(255, 255, 255, 0.45);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 14px;
      }
      .progress-bar-wrap {
        height: 3px; width: 100%; background: rgba(255, 255, 255, 0.08);
        position: relative; overflow: hidden;
      }
      .progress-bar {
        position: absolute; height: 100%; width: 40%;
        background: linear-gradient(90deg, transparent, #818cf8, #c084fc, transparent);
        animation: progressAnim 1.6s infinite ease-in-out;
      }
      @keyframes progressAnim {
        0% { left: -40%; }
        100% { left: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="hero">
      <div class="bg-art"></div>
      <div class="overlay"></div>
      <div class="content">
        <div class="badge-row">
          <div class="badge">${config.logoText || 'MV'}</div>
          <div class="title-group">
            <h1>${config.productName || 'MediaView Studio'}</h1>
            <div class="version">${config.versionText || 'v1.0.0'} &bull; Master Edition</div>
          </div>
        </div>
        <p class="tagline">${config.tagline || 'Universal Media Asset Viewer with Video Frame Zoom & Timelapse Inspector'}</p>
        <div class="footer-row">
          <span>${config.artistName || 'Anything Creative Ecosystem'}</span>
          <span>${config.author ? 'Built by ' + config.author : ''}</span>
        </div>
      </div>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar"></div>
    </div>
  </body>
  </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });

  const duration = config.durationMs || 2200;
  splashTimer = setTimeout(() => {
    closeChildAppSplash();
    onFinished();
  }, duration);
}

export function closeChildAppSplash(): void {
  if (splashTimer) {
    clearTimeout(splashTimer);
    splashTimer = null;
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}
