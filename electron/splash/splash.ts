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
    durationMs: 800,
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
            <!-- Apple Aqua Blue Open Folder Logo -->
            <svg viewBox="0 0 1024 1024" width="72" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splashAquaBack" x1="512" y1="140" x2="512" y2="880" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1E88E5"/>
                  <stop offset="35%" stopColor="#1565C0"/>
                  <stop offset="75%" stopColor="#0D47A1"/>
                  <stop offset="100%" stopColor="#0A2472"/>
                </linearGradient>
                <linearGradient id="splashAquaRim" x1="200" y1="160" x2="800" y2="160" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#90CAF9" stopOpacity="0.8"/>
                  <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.95"/>
                  <stop offset="100%" stopColor="#90CAF9" stopOpacity="0.7"/>
                </linearGradient>
                <linearGradient id="splashAquaFront" x1="512" y1="360" x2="512" y2="920" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#42A5F5"/>
                  <stop offset="25%" stopColor="#2196F3"/>
                  <stop offset="65%" stopColor="#1976D2"/>
                  <stop offset="100%" stopColor="#0D47A1"/>
                </linearGradient>
                <linearGradient id="splashFrontGloss" x1="140" y1="380" x2="880" y2="380" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3"/>
                  <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.95"/>
                  <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.9"/>
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3"/>
                </linearGradient>
                <linearGradient id="splashDocGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF"/>
                  <stop offset="100%" stopColor="#F1F5F9"/>
                </linearGradient>
              </defs>

              <path d="M 180 200 C 180 156 216 120 260 120 H 430 C 464 120 496 138 518 168 L 570 240 H 844 C 888 240 924 276 924 320 V 800 C 924 844 888 880 844 880 H 180 C 136 880 100 844 100 800 V 280 C 100 236 136 200 180 200 Z" fill="url(#splashAquaBack)" stroke="#0A3875" strokeWidth="6"/>
              <path d="M 260 125 H 428 C 460 125 490 142 512 170 L 564 242" stroke="url(#splashAquaRim)" strokeWidth="8" strokeLinecap="round"/>

              <rect x="110" y="240" width="804" height="380" fill="#061A3A" opacity="0.7"/>

              <g transform="rotate(-3 512 380)">
                <path d="M 240 130 H 640 L 770 260 V 680 C 770 702 752 720 730 720 H 240 C 218 720 200 702 200 680 V 170 C 200 148 218 130 240 130 Z" fill="url(#splashDocGrad)" stroke="#CBD5E1" strokeWidth="4"/>
                <path d="M 640 130 V 246 C 640 260 652 270 666 270 H 770 Z" fill="#94A3B8"/>
                <rect x="250" y="270" width="460" height="16" rx="8" fill="#1E88E5" opacity="0.8"/>
                <rect x="250" y="304" width="380" height="14" rx="7" fill="#64B5F6" opacity="0.6"/>
              </g>

              <path d="M 136 470 C 136 444 158 424 192 424 H 832 C 866 424 888 444 888 470 L 924 790 C 928 844 892 880 844 880 H 180 C 132 880 96 844 100 790 Z" fill="url(#splashAquaFront)" stroke="#0A3875" strokeWidth="7"/>
              <path d="M 190 428 H 834" stroke="url(#splashFrontGloss)" strokeWidth="10" strokeLinecap="round"/>

              <!-- Apple Finder Face Emblem -->
              <g opacity="0.85">
                <rect x="460" y="580" width="10" height="28" rx="5" fill="#FFFFFF"/>
                <rect x="554" y="580" width="10" height="28" rx="5" fill="#FFFFFF"/>
                <rect x="508" y="570" width="8" height="84" rx="4" fill="#FFFFFF" opacity="0.8"/>
                <path d="M 450 670 Q 512 730 574 670" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" fill="none"/>
              </g>
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

  const duration = Math.min(config.durationMs || 800, 1000);
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
