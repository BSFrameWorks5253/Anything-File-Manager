import React from 'react';

interface MacFolderIconProps {
  className?: string;
  size?: number;
  type?: 'generic' | 'desktop' | 'downloads' | 'pictures' | 'videos' | 'documents' | 'home';
}

/**
 * Pixel-perfect Apple macOS Sequoia / Sonoma Aqua Blue Folder Icon
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
      className={`select-none filter drop-shadow-md transition-transform duration-150 ${className}`}
    >
      <defs>
        {/* Apple macOS Authentic Aqua Blue Back Plate */}
        <linearGradient id="macAquaBack" x1="60" y1="18" x2="60" y2="102" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E88E5" />
          <stop offset="40%" stopColor="#1565C0" />
          <stop offset="100%" stopColor="#0D47A1" />
        </linearGradient>

        {/* Back Plate Specular Rim */}
        <linearGradient id="macAquaRim" x1="20" y1="20" x2="100" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#90CAF9" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#E3F2FD" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#90CAF9" stopOpacity="0.6" />
        </linearGradient>

        {/* Apple macOS Front Flap Radiant Aqua Gradient */}
        <linearGradient id="macAquaFront" x1="60" y1="36" x2="60" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#42A5F5" />
          <stop offset="30%" stopColor="#2196F3" />
          <stop offset="70%" stopColor="#1976D2" />
          <stop offset="100%" stopColor="#0D47A1" />
        </linearGradient>

        {/* Top Flap Glass Gloss Highlight */}
        <linearGradient id="macAquaGloss" x1="12" y1="38" x2="108" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3" />
        </linearGradient>

        {/* Inner Peeking Document Sheet */}
        <linearGradient id="macInnerPaper" x1="60" y1="26" x2="60" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Drop Shadow Underneath */}
        <filter id="macFolderShadow" x="-10%" y="0%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#001830" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* 1. Back Folder Plate (with Apple rounded tab) */}
      <g filter="url(#macFolderShadow)">
        <path
          d="
            M 14 28
            C 14 22.5 18.5 18 24 18
            H 46
            C 50 18 53.5 20.2 56 23.5
            L 62 31.5
            H 96
            C 101.5 31.5 106 36 106 41.5
            V 92
            C 106 97.5 101.5 102 96 102
            H 24
            C 18.5 102 14 97.5 14 92
            Z
          "
          fill="url(#macAquaBack)"
          stroke="#0A3875"
          strokeWidth="1.2"
        />

        {/* Tab Top Rim Light */}
        <path
          d="M 24 19.5 H 45.5 C 49 19.5 52.2 21.5 54.5 24.5 L 60.5 32.5"
          stroke="url(#macAquaRim)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* 2. Inner Folder Cavity & Peeking Document Sheet */}
      <rect x="18" y="32" width="84" height="20" rx="3" fill="#0A2540" opacity="0.6" />
      <path
        d="M 22 28 H 82 C 84.5 28 86 29.5 86 32 V 44 H 18 V 32 C 18 29.5 19.5 28 22 28 Z"
        fill="url(#macInnerPaper)"
        stroke="#CBD5E1"
        strokeWidth="0.8"
      />
      <rect x="24" y="33" width="30" height="2" rx="1" fill="#94A3B8" opacity="0.6" />
      <rect x="24" y="37" width="20" height="2" rx="1" fill="#CBD5E1" opacity="0.8" />

      {/* 3. Front Flap (Apple Sonoma styled curved Aqua visor) */}
      <g filter="url(#macFolderShadow)">
        <path
          d="
            M 10 44
            C 10 39.5 13.5 36 18 36
            H 102
            C 106.5 36 110 39.5 110 44
            V 94
            C 110 99.5 105.5 104 100 104
            H 20
            C 14.5 104 10 99.5 10 94
            Z
          "
          fill="url(#macAquaFront)"
          stroke="#0A3875"
          strokeWidth="1.2"
        />

        {/* Crisp White Top Lip Specular Reflection */}
        <path
          d="M 18 37.5 H 102"
          stroke="url(#macAquaGloss)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 20 39 H 100"
          stroke="#FFFFFF"
          strokeWidth="0.8"
          strokeOpacity="0.4"
          strokeLinecap="round"
        />
      </g>

      {/* 4. Engraved System Folder Glyphs (Pure Apple Style) */}
      {type === 'home' && (
        <g transform="translate(60, 70)" opacity="0.75">
          <path
            d="M -12 2 L 0 -9 L 12 2 V 12 C 12 13 11 14 10 14 H -10 C -11 14 -12 13 -12 12 Z"
            fill="#FFFFFF"
          />
          <path d="M -3 14 V 6 H 3 V 14" fill="#0D47A1" />
        </g>
      )}

      {type === 'desktop' && (
        <g transform="translate(60, 70)" opacity="0.75">
          <rect x="-14" y="-10" width="28" height="18" rx="2" fill="#FFFFFF" />
          <rect x="-11" y="-7" width="22" height="12" rx="1" fill="#0D47A1" />
          <path d="M -4 10 H 4 L 6 14 H -6 Z" fill="#FFFFFF" />
        </g>
      )}

      {type === 'downloads' && (
        <g transform="translate(60, 70)" opacity="0.75">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" fillOpacity="0.25" stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M 0 -7 V 5 M -5 0 L 0 5 L 5 0" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {type === 'pictures' && (
        <g transform="translate(60, 70)" opacity="0.75">
          <rect x="-14" y="-10" width="28" height="20" rx="3" fill="#FFFFFF" />
          <rect x="-12" y="-8" width="24" height="16" rx="2" fill="#0D47A1" />
          <circle cx="-6" cy="-2" r="2.5" fill="#FFD54F" />
          <path d="M -12 6 L -5 -1 L 2 5 L 6 2 L 12 6 Z" fill="#81C784" />
        </g>
      )}

      {type === 'videos' && (
        <g transform="translate(60, 70)" opacity="0.75">
          <rect x="-14" y="-9" width="28" height="18" rx="3" fill="#FFFFFF" />
          <polygon points="-4,-4 -4,4 5,0" fill="#0D47A1" />
        </g>
      )}

      {type === 'documents' && (
        <g transform="translate(60, 70)" opacity="0.75">
          <rect x="-10" y="-12" width="20" height="24" rx="2" fill="#FFFFFF" />
          <line x1="-6" y1="-6" x2="6" y2="-6" stroke="#0D47A1" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-6" y1="-1" x2="6" y2="-1" stroke="#0D47A1" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-6" y1="4" x2="2" y2="4" stroke="#0D47A1" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
};

interface MacDocumentIconProps {
  className?: string;
  size?: number;
  ext?: string;
}

/**
 * Pixel-perfect Apple macOS Document Icon with Crisp Extension Badges
 */
export const MacDocumentIcon: React.FC<MacDocumentIconProps> = ({
  className = '',
  size = 64,
  ext = ''
}) => {
  const cleanExt = (ext || '').replace(/^\./, '').toUpperCase() || 'FILE';

  const getBadgeStyle = (extension: string) => {
    switch (extension) {
      case 'PDF':
        return { bg: '#DC2626', text: '#FFFFFF' };
      case 'ZIP':
      case 'RAR':
      case '7Z':
      case 'TAR':
      case 'GZ':
        return { bg: '#D97706', text: '#FFFFFF' };
      case 'DOC':
      case 'DOCX':
        return { bg: '#2563EB', text: '#FFFFFF' };
      case 'XLS':
      case 'XLSX':
      case 'CSV':
        return { bg: '#059669', text: '#FFFFFF' };
      case 'PPT':
      case 'PPTX':
        return { bg: '#EA580C', text: '#FFFFFF' };
      case 'JS':
      case 'TS':
      case 'JSX':
      case 'TSX':
        return { bg: '#F59E0B', text: '#000000' };
      case 'HTML':
      case 'CSS':
        return { bg: '#0284C7', text: '#FFFFFF' };
      case 'JSON':
      case 'XML':
      case 'YAML':
      case 'YML':
        return { bg: '#7C3AED', text: '#FFFFFF' };
      case 'TXT':
      case 'MD':
      case 'LOG':
        return { bg: '#475569', text: '#FFFFFF' };
      case 'MP3':
      case 'WAV':
      case 'FLAC':
      case 'AAC':
        return { bg: '#DB2777', text: '#FFFFFF' };
      default:
        return { bg: '#64748B', text: '#FFFFFF' };
    }
  };

  const { bg: badgeBg, text: badgeText } = getBadgeStyle(cleanExt);
  const badgeLabel = cleanExt.length > 5 ? cleanExt.slice(0, 4) : cleanExt;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none filter drop-shadow-md transition-transform duration-150 ${className}`}
    >
      <defs>
        <linearGradient id="macDocFace" x1="60" y1="12" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </linearGradient>

        <linearGradient id="macFoldShadow" x1="82" y1="12" x2="82" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.3" />
        </linearGradient>

        <linearGradient id="macFoldFlap" x1="94" y1="14" x2="82" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>

      {/* Main Document Body */}
      <path
        d="M 28 20 C 28 15.5 31.5 12 36 12 H 74 L 96 34 V 100 C 96 104.5 92.5 108 88 108 H 36 C 31.5 108 28 104.5 28 100 Z"
        fill="url(#macDocFace)"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />

      {/* Dog-Ear Fold Shadow */}
      <path d="M 72 12 V 32 C 72 34 74 36 76 36 H 96" fill="none" stroke="#94A3B8" strokeWidth="1.2" opacity="0.5" />

      {/* Dog-Ear Fold Flap */}
      <path d="M 74 12 L 96 34 H 78 C 75.8 34 74 32.2 74 30 Z" fill="url(#macFoldFlap)" stroke="#CBD5E1" strokeWidth="1" />

      {/* Center Color-Coded Extension Pill Badge */}
      <rect x="36" y="58" width="48" height="22" rx="5" fill={badgeBg} />
      <text
        x="60"
        y="73.5"
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
      <rect x="38" y="44" width="28" height="2.5" rx="1.25" fill="#CBD5E1" />
      <rect x="38" y="88" width="44" height="2" rx="1" fill="#E2E8F0" />
      <rect x="38" y="93" width="30" height="2" rx="1" fill="#E2E8F0" />
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
