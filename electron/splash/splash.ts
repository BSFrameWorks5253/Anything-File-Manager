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
            <!-- Premier AFM Electric Emerald Open Folder Logo -->
            <svg viewBox="0 0 1024 1024" width="72" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splashBackGrad" x1="15%" y1="10%" x2="85%" y2="90%">
                  <stop offset="0%" stopColor="#00E5A3"/>
                  <stop offset="35%" stopColor="#00B4D8"/>
                  <stop offset="70%" stopColor="#0077B6"/>
                  <stop offset="100%" stopColor="#03045E"/>
                </linearGradient>
                <linearGradient id="splashRimGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8"/>
                  <stop offset="40%" stopColor="#64DFDF" stopOpacity="0.9"/>
                  <stop offset="80%" stopColor="#00E5A3" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.5"/>
                </linearGradient>
                <linearGradient id="splashFrontGlass" x1="10%" y1="0%" x2="90%" y2="100%">
                  <stop offset="0%" stopColor="#00F5A0" stopOpacity="0.88"/>
                  <stop offset="45%" stopColor="#00B4D8" stopOpacity="0.82"/>
                  <stop offset="85%" stopColor="#0077B6" stopOpacity="0.92"/>
                  <stop offset="100%" stopColor="#023E8A" stopOpacity="0.96"/>
                </linearGradient>
                <linearGradient id="splashGlassGloss" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3"/>
                  <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.95"/>
                  <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.9"/>
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3"/>
                </linearGradient>
                <linearGradient id="splashSheetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF"/>
                  <stop offset="100%" stopColor="#E2E8F0"/>
                </linearGradient>
                <linearGradient id="splashHoloSheet" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7209B7"/>
                  <stop offset="50%" stopColor="#4361EE"/>
                  <stop offset="100%" stopColor="#4CC9F0"/>
                </linearGradient>
                <linearGradient id="splashPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F5A0"/>
                  <stop offset="100%" stopColor="#00B4D8"/>
                </linearGradient>
              </defs>

              <path d="M 190 190 L 410 190 C 455 190 480 220 520 280 C 540 306 568 312 608 312 L 834 312 C 892 312 914 334 914 392 L 914 786 C 914 844 892 866 834 866 L 190 866 C 132 866 110 844 110 786 L 110 270 C 110 212 132 190 190 190 Z" fill="url(#splashBackGrad)" stroke="#003554" strokeWidth="6"/>
              <path d="M 190 195 L 408 195 C 452 195 478 222 516 282" stroke="url(#splashRimGlow)" strokeWidth="7" strokeLinecap="round"/>

              <rect x="116" y="312" width="792" height="340" fill="#03071E" opacity="0.85"/>

              <g transform="rotate(7 512 400)">
                <rect x="360" y="160" width="460" height="490" rx="28" fill="url(#splashHoloSheet)" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="3"/>
                <rect x="390" y="200" width="180" height="20" rx="10" fill="#FFFFFF" opacity="0.6"/>
                <rect x="390" y="235" width="280" height="14" rx="7" fill="#FFFFFF" opacity="0.4"/>
              </g>

              <g transform="rotate(-3.5 512 390)">
                <path d="M 240 140 L 620 140 L 760 280 L 760 670 C 760 690 744 706 724 706 L 240 706 C 220 706 204 690 204 670 L 204 176 C 204 156 220 140 240 140 Z" fill="url(#splashSheetGrad)" stroke="#CBD5E1" strokeWidth="4"/>
                <path d="M 620 140 L 620 256 C 620 270 632 280 646 280 L 760 280 Z" fill="#94A3B8"/>
                <path d="M 620 140 L 760 280" stroke="#64748B" strokeWidth="3"/>
                <rect x="256" y="212" width="180" height="40" rx="20" fill="url(#splashPlayGrad)"/>
                <polygon points="286,224 286,240 302,232" fill="#FFFFFF"/>
                <rect x="256" y="280" width="450" height="16" rx="8" fill="#0077B6" opacity="0.8"/>
                <rect x="256" y="312" width="360" height="14" rx="7" fill="#0096C7" opacity="0.5"/>
                <rect x="256" y="342" width="400" height="14" rx="7" fill="#48CAE4" opacity="0.4"/>
              </g>

              <path d="M 146 480 C 146 454 166 436 200 436 L 824 436 C 858 436 878 454 878 480 L 914 786 C 918 844 892 866 834 866 L 190 866 C 132 866 106 844 110 786 Z" fill="url(#splashFrontGlass)" stroke="#003554" strokeWidth="7"/>
              <path d="M 198 440 L 826 440" stroke="url(#splashGlassGloss)" strokeWidth="10" strokeLinecap="round"/>
              <path d="M 210 448 L 814 448" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round"/>

              <g transform="translate(512, 650)">
                <circle cx="0" cy="0" r="74" fill="#03045E" stroke="url(#splashRimGlow)" strokeWidth="4" opacity="0.9"/>
                <path d="M -30 38 L 0 -38 L 30 38 L 12 38 L 0 8 L -12 38 Z" fill="url(#splashPlayGrad)"/>
                <circle cx="0" cy="3" r="5" fill="#FFFFFF"/>
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
