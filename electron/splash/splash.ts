import fs from 'fs';
import path from 'path';
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
  appId = 'anything-file-manager',
  fallbackAppName = 'Anything File Manager'
): ChildAppLoaderConfig {
  const defaultFallback: ChildAppLoaderConfig = {
    appId,
    enabled: true,
    productName: fallbackAppName,
    versionText: `v${app && typeof app.getVersion === 'function' ? app.getVersion() : '1.0.0'}`,
    tagline: 'Next-Gen macOS Finder & Windows 11 Explorer Hybrid',
    artistName: 'Anything Creative Ecosystem',
    artworkTitle: 'Anything File Manager',
    durationMs: 1600,
    logoText: 'AFM',
    badgeGradient: 'linear-gradient(135deg, #026361 0%, #05A384 50%, #12E5A8 100%)',
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
    path.join(__dirname, '..', '..', 'loader-config.json'),
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

  const SPLASH_WIDTH = 680;
  const SPLASH_HEIGHT = 400;

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
    backgroundColor: '#0c0d14',
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
        background: #090a10;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
        display: flex; flex-direction: column;
        border: 1px solid rgba(18, 229, 168, 0.25);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(7, 186, 144, 0.2);
        overflow: hidden;
        border-radius: 16px;
      }
      .hero {
        position: relative;
        flex: 1;
        overflow: hidden;
        background: radial-gradient(circle at 65% 25%, #033630 0%, #061917 45%, #090a10 85%);
      }
      .ambient-glow {
        position: absolute;
        top: -60px; right: -60px;
        width: 320px; height: 320px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(18, 229, 168, 0.22) 0%, transparent 70%);
        filter: blur(40px);
        pointer-events: none;
      }
      .content {
        position: relative; z-index: 2;
        padding: 38px 44px;
        display: flex; flex-direction: column; justify-content: flex-end;
        height: 100%;
      }
      .badge-row {
        display: flex; align-items: center; gap: 20px; margin-bottom: 16px;
      }
      .logo-container {
        width: 68px; height: 68px;
        display: flex; align-items: center; justify-content: center;
        filter: drop-shadow(0 10px 24px rgba(7, 186, 144, 0.45));
        flex-shrink: 0;
      }
      .title-group h1 {
        font-size: 28px; font-weight: 800; letter-spacing: -0.025em; color: #ffffff;
        display: flex; align-items: center; gap: 10px;
      }
      .title-group .badge-pill {
        font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
        padding: 3px 8px; border-radius: 6px;
        background: rgba(18, 229, 168, 0.18);
        border: 1px solid rgba(18, 229, 168, 0.4);
        color: #12E5A8;
      }
      .title-group .version {
        font-size: 11px; font-weight: 600; color: #08C296; text-transform: uppercase; letter-spacing: 0.08em;
        margin-top: 3px;
      }
      .tagline {
        font-size: 13.5px; color: rgba(255, 255, 255, 0.75); margin-bottom: 24px; max-width: 540px; line-height: 1.45;
      }
      .footer-row {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 11px; color: rgba(255, 255, 255, 0.45);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 14px;
      }
      .footer-row strong {
        color: #12E5A8;
      }
      .progress-bar-wrap {
        height: 3px; width: 100%; background: rgba(255, 255, 255, 0.06);
        position: relative; overflow: hidden;
      }
      .progress-bar {
        position: absolute; height: 100%; width: 45%;
        background: linear-gradient(90deg, transparent, #048A7B, #12E5A8, #07B38C, transparent);
        animation: progressAnim 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes progressAnim {
        0% { left: -45%; }
        100% { left: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="hero">
      <div class="ambient-glow"></div>
      <div class="content">
        <div class="badge-row">
          <div class="logo-container">
            <!-- Premier AFM Emerald Open Folder Logo -->
            <svg viewBox="0 0 1024 1024" width="68" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splashBack" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#026361"/>
                  <stop offset="45%" stopColor="#048A7B"/>
                  <stop offset="100%" stopColor="#07B38C"/>
                </linearGradient>
                <linearGradient id="splashFront" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#05A384"/>
                  <stop offset="40%" stopColor="#08C296"/>
                  <stop offset="100%" stopColor="#12E5A8"/>
                </linearGradient>
                <linearGradient id="splashCavity" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#012422" stopOpacity="0.95"/>
                  <stop offset="100%" stopColor="#024D46" stopOpacity="0.2"/>
                </linearGradient>
              </defs>

              <!-- Back Plate -->
              <path d="M 190 190 L 390 190 C 445 190 475 215 515 275 C 535 298 560 304 600 304 L 834 304 C 888 304 904 320 904 374 L 904 786 C 904 840 888 856 834 856 L 190 856 C 136 856 120 840 120 786 L 120 260 C 120 206 136 190 190 190 Z" fill="url(#splashBack)" stroke="#024744" strokeWidth="6"/>

              <!-- Cavity -->
              <rect x="124" y="304" width="776" height="340" fill="url(#splashCavity)"/>

              <!-- Peeking Document Sheet -->
              <g transform="rotate(-3.5 512 380)">
                <path d="M 250 130 L 640 130 L 770 260 L 770 660 C 770 678 756 692 738 692 L 250 692 C 232 692 218 678 218 660 L 218 162 C 218 144 232 130 250 130 Z" fill="#FFFFFF" stroke="#64748B" strokeWidth="5"/>
                <path d="M 640 130 L 640 242 C 640 256 652 260 666 260 L 770 260 Z" fill="#CBD5E1"/>
                <path d="M 640 130 L 770 260" stroke="#94A3B8" strokeWidth="4"/>
                <rect x="270" y="210" width="160" height="34" rx="17" fill="#048A7B"/>
                <polygon points="296,220 296,234 310,227" fill="#FFFFFF"/>
                <rect x="270" y="280" width="380" height="18" rx="9" fill="#64748B" opacity="0.65"/>
                <rect x="270" y="318" width="300" height="16" rx="8" fill="#94A3B8" opacity="0.5"/>
              </g>

              <!-- Front Flap (Open) -->
              <path d="M 150 490 C 150 466 168 450 200 450 L 824 450 C 856 450 874 466 874 490 L 908 786 C 912 840 888 860 834 860 L 190 860 C 136 860 112 840 116 786 Z" fill="url(#splashFront)" stroke="#035B54" strokeWidth="7"/>
              <path d="M 198 454 L 826 454" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity="0.9"/>
            </svg>
          </div>
          <div class="title-group">
            <h1>
              ${config.productName || 'Anything File Manager'}
              <span class="badge-pill">Pro</span>
            </h1>
            <div class="version">${config.versionText || 'v1.0.0'} &bull; Master Edition</div>
          </div>
        </div>
        <p class="tagline">${config.tagline || 'Next-Gen macOS Finder & Windows 11 Explorer Hybrid'}</p>
        <div class="footer-row">
          <span>${config.artistName || 'Anything Creative Ecosystem'}</span>
          <span>${config.author ? 'Crafted by <strong>' + config.author + '</strong>' : ''}</span>
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

  const duration = config.durationMs || 1600;
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
