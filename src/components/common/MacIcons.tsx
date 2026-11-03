import React from 'react';

interface MacFolderIconProps {
  className?: string;
  size?: number;
  type?: 'generic' | 'desktop' | 'downloads' | 'pictures' | 'videos' | 'documents' | 'home';
}

/**
 * Pixel-perfect Apple macOS Big Sur / Sonoma Aqua Blue Folder Icon
 */
export const MacFolderIcon: React.FC<MacFolderIconProps> = ({
  className = '',
  size = 64,
  type = 'generic'
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none filter drop-shadow-md ${className}`}
    >
      <defs>
        {/* Back Tab & Body Gradient - Vibrant Emerald Teal (Image 2 style) */}
        <linearGradient id="macFolderBack" x1="60" y1="18" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#04937d" />
          <stop offset="100%" stopColor="#026b5d" />
        </linearGradient>

        {/* Front Flap Gradient - Vivid Cyan Mint / Emerald */}
        <linearGradient id="macFolderFront" x1="60" y1="36" x2="60" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0cd9a4" />
          <stop offset="45%" stopColor="#05ba8c" />
          <stop offset="100%" stopColor="#028675" />
        </linearGradient>

        {/* Top Flap Highlight Rim */}
        <linearGradient id="macFolderRim" x1="60" y1="36" x2="60" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>

        {/* Crisp White Peeking Paper / Inner Folder Flap Slit (Image 2 signature) */}
        <linearGradient id="macFolderPaper" x1="60" y1="26" x2="60" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>

        {/* Subtle Bottom Crease Shadow */}
        <radialGradient id="macFolderShadow" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#01362e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#01362e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Back Folder Tab & Base */}
      <path
        d="M12 28C12 23.5817 15.5817 20 20 20H46C49.5 20 52.8 22 55 25L61 32H100C104.418 32 108 35.5817 108 40V92C108 97.5228 103.523 102 98 102H22C16.4772 102 12 97.5228 12 92V28Z"
        fill="url(#macFolderBack)"
        stroke="#01483e"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />

      {/* Internal Crisp White Paper Sheet / Opening Crescent Peek */}
      <path
        d="M16 38C20 33 28 32 36 32H84C92 32 100 33 104 38C100 35 92 34 84 34H36C28 34 20 35 16 38Z"
        fill="url(#macFolderPaper)"
        opacity="0.95"
      />
      <rect x="20" y="28" width="80" height="18" rx="4" fill="url(#macFolderPaper)" opacity="0.95" />

      {/* Front Flap */}
      <path
        d="M10 44C10 39.5817 13.5817 36 18 36H102C106.418 36 110 39.5817 110 44V94C110 99.5228 105.523 104 100 104H20C14.4772 104 10 99.5228 10 94V44Z"
        fill="url(#macFolderFront)"
        stroke="#01483e"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />

      {/* Top Edge Highlight */}
      <path
        d="M10 44C10 39.5817 13.5817 36 18 36H102C106.418 36 110 39.5817 110 44V48H10V44Z"
        fill="url(#macFolderRim)"
      />

      {/* Subtle Inner Bevel / Crease */}
      <path
        d="M12 46C12 43 14 41 18 41H102C106 41 108 43 108 46"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />

      {/* Bottom Crease Depth */}
      <rect x="10" y="80" width="100" height="24" rx="10" fill="url(#macFolderShadow)" />

      {/* Folder Specialization Glyph Emblems (macOS style) */}
      {type === 'home' && (
        <path
          d="M60 55L45 68H51V84H57V74H63V84H69V68H75L60 55Z"
          fill="#ffffff"
          fillOpacity="0.75"
        />
      )}
      {type === 'downloads' && (
        <g fill="#ffffff" fillOpacity="0.75">
          <path d="M60 54V76M60 76L52 68M60 76L68 68" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M46 82H74" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {type === 'pictures' && (
        <g fill="#ffffff" fillOpacity="0.75">
          <rect x="44" y="56" width="32" height="24" rx="3" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <circle cx="53" cy="64" r="3" fill="#ffffff" fillOpacity="0.8" />
          <path d="M46 76L56 67L64 73L70 66L74 71" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {type === 'videos' && (
        <g fill="#ffffff" fillOpacity="0.75">
          <rect x="42" y="56" width="36" height="24" rx="4" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <polygon points="56,62 68,68 56,74" fill="#ffffff" fillOpacity="0.85" />
        </g>
      )}
      {type === 'desktop' && (
        <g fill="#ffffff" fillOpacity="0.75">
          <rect x="42" y="54" width="36" height="24" rx="3" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <line x1="60" y1="78" x2="60" y2="84" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="52" y1="84" x2="68" y2="84" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {type === 'documents' && (
        <g fill="#ffffff" fillOpacity="0.75">
          <path d="M48 56C48 54 49 53 51 53H65L73 61V81C73 83 72 84 70 84H51C49 84 48 83 48 81V56Z" stroke="#ffffff" strokeWidth="2.2" fill="none" />
          <path d="M64 53V61H73" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="53" y1="67" x2="68" y2="67" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <line x1="53" y1="73" x2="65" y2="73" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
};

interface MacDocumentIconProps {
  ext?: string;
  className?: string;
  size?: number;
}

/**
 * Pixel-perfect Apple macOS Document Sheet with Dog-Ear Corner Fold & Colored Badge
 */
export const MacDocumentIcon: React.FC<MacDocumentIconProps> = ({
  ext = '',
  className = '',
  size = 64
}) => {
  const cleanExt = (ext || '').toLowerCase().replace('.', '');

  // File category color palette matching Apple macOS native QuickLook & Finder
  let badgeBg = '#64748b'; // default slate
  let badgeText = '#ffffff';
  let badgeLabel = cleanExt.toUpperCase() || 'FILE';

  if (['ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'py', 'rs', 'go', 'c', 'cpp', 'java'].includes(cleanExt)) {
    badgeBg = '#0071e3'; // macOS code blue
    badgeLabel = cleanExt.toUpperCase();
  } else if (['xlsx', 'xls', 'csv', 'numbers'].includes(cleanExt)) {
    badgeBg = '#10b981'; // Numbers green
    badgeLabel = 'XLS';
  } else if (['pptx', 'ppt', 'key', 'keynote'].includes(cleanExt)) {
    badgeBg = '#f59e0b'; // Keynote amber
    badgeLabel = 'PPT';
  } else if (['docx', 'doc', 'pages', 'rtf', 'txt', 'md'].includes(cleanExt)) {
    badgeBg = '#3b82f6'; // Pages blue
    badgeLabel = cleanExt === 'md' ? 'MD' : cleanExt.toUpperCase();
  } else if (cleanExt === 'pdf') {
    badgeBg = '#ef4444'; // PDF red
    badgeLabel = 'PDF';
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(cleanExt)) {
    badgeBg = '#8b5cf6'; // Archive purple
    badgeLabel = 'ZIP';
  } else if (['exe', 'bat', 'cmd', 'ps1', 'sh'].includes(cleanExt)) {
    badgeBg = '#475569'; // Executable grey
    badgeLabel = cleanExt.toUpperCase();
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none filter drop-shadow-md ${className}`}
    >
      <defs>
        {/* Document Sheet Face Gradient */}
        <linearGradient id="macDocFace" x1="60" y1="12" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>

        {/* Fold Corner Shadow */}
        <linearGradient id="macFoldShadow" x1="82" y1="12" x2="82" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3" />
        </linearGradient>

        {/* Fold Corner Flap */}
        <linearGradient id="macFoldFlap" x1="94" y1="14" x2="82" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>

      {/* Main Document Body (with clipped top-right corner) */}
      <path
        d="M26 20C26 15.5817 29.5817 12 34 12H76L98 34V100C98 104.418 94.4183 108 90 108H34C29.5817 108 26 104.418 26 100V20Z"
        fill="url(#macDocFace)"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />

      {/* Dog-Ear Fold Shadow */}
      <path
        d="M74 12V32C74 34 76 36 78 36H98"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.2"
        opacity="0.5"
      />

      {/* Dog-Ear Fold Flap */}
      <path
        d="M76 12L98 34H80C77.7909 34 76 32.2091 76 30V12Z"
        fill="url(#macFoldFlap)"
        stroke="#cbd5e1"
        strokeWidth="1"
      />

      {/* Center Color-Coded Extension Pill Badge */}
      <rect
        x="36"
        y="58"
        width="48"
        height="22"
        rx="5"
        fill={badgeBg}
      />
      <text
        x="60"
        y="73"
        fill={badgeText}
        fontSize="10"
        fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
        textAnchor="middle"
        letterSpacing="0.5"
      >
        {badgeLabel}
      </text>

      {/* Subtle Document Text Rule Lines */}
      <rect x="38" y="44" width="30" height="2.5" rx="1.25" fill="#cbd5e1" />
      <rect x="38" y="88" width="44" height="2" rx="1" fill="#e2e8f0" />
      <rect x="38" y="93" width="32" height="2" rx="1" fill="#e2e8f0" />
    </svg>
  );
};

interface MacTrafficLightsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

/**
 * Native macOS Window Traffic Lights (Red, Yellow, Green with hover glyphs)
 */
export const MacTrafficLights: React.FC<MacTrafficLightsProps> = ({
  onClose,
  onMinimize,
  onMaximize
}) => {
  return (
    <div className="flex items-center gap-2 group/lights px-1">
      {/* Close button (Red) */}
      <button
        onClick={onClose}
        className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] flex items-center justify-center hover:brightness-95 transition-all shadow-sm active:brightness-90"
        title="Close"
      >
        <svg className="w-1.5 h-1.5 text-[#4c0002] opacity-0 group-hover/lights:opacity-100 transition-opacity" viewBox="0 0 6 6" fill="currentColor">
          <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Minimize button (Yellow) */}
      <button
        onClick={onMinimize}
        className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24] flex items-center justify-center hover:brightness-95 transition-all shadow-sm active:brightness-90"
        title="Minimize"
      >
        <svg className="w-1.5 h-1.5 text-[#5d3b00] opacity-0 group-hover/lights:opacity-100 transition-opacity" viewBox="0 0 6 6" fill="currentColor">
          <line x1="0.5" y1="3" x2="5.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Maximize / Zoom button (Green) */}
      <button
        onClick={onMaximize}
        className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] flex items-center justify-center hover:brightness-95 transition-all shadow-sm active:brightness-90"
        title="Zoom / Fullscreen"
      >
        <svg className="w-1.5 h-1.5 text-[#004707] opacity-0 group-hover/lights:opacity-100 transition-opacity" viewBox="0 0 6 6" fill="currentColor">
          <polygon points="1,1 5,1 1,5" />
          <polygon points="5,5 1,5 5,1" />
        </svg>
      </button>
    </div>
  );
};
