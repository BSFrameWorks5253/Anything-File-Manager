import React, { useState } from 'react';

interface AfmLogoProps {
  size?: number;
  isOpen?: boolean;
  className?: string;
  showTitle?: boolean;
}

export const AfmLogo: React.FC<AfmLogoProps> = ({
  size = 28,
  isOpen = true,
  className = '',
  showTitle = false
}) => {
  const [hovered, setHovered] = useState(false);
  const activeOpen = hovered ? !isOpen : isOpen;

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <div
        className="relative cursor-pointer transition-transform duration-200 hover:scale-105 flex-shrink-0"
        style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Anything File Manager"
      >
        <svg
          viewBox="0 0 1024 1024"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md transition-all duration-300"
        >
          <defs>
            <linearGradient id="logoAquaBack" x1="512" y1="140" x2="512" y2="880" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E88E5"/>
              <stop offset="35%" stopColor="#1565C0"/>
              <stop offset="75%" stopColor="#0D47A1"/>
              <stop offset="100%" stopColor="#0A2472"/>
            </linearGradient>

            <linearGradient id="logoAquaRim" x1="200" y1="160" x2="800" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#90CAF9" stopOpacity="0.8"/>
              <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.95"/>
              <stop offset="100%" stopColor="#90CAF9" stopOpacity="0.7"/>
            </linearGradient>

            <linearGradient id="logoAquaFront" x1="512" y1="360" x2="512" y2="920" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#42A5F5"/>
              <stop offset="25%" stopColor="#2196F3"/>
              <stop offset="65%" stopColor="#1976D2"/>
              <stop offset="100%" stopColor="#0D47A1"/>
            </linearGradient>

            <linearGradient id="logoFrontGloss" x1="140" y1="380" x2="880" y2="380" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3"/>
              <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.95"/>
              <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3"/>
            </linearGradient>

            <linearGradient id="logoDocGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF"/>
              <stop offset="100%" stopColor="#F1F5F9"/>
            </linearGradient>
          </defs>

          {/* Folder Back Plate */}
          <path
            d="M 180 200 C 180 156 216 120 260 120 H 430 C 464 120 496 138 518 168 L 570 240 H 844 C 888 240 924 276 924 320 V 800 C 924 844 888 880 844 880 H 180 C 136 880 100 844 100 800 V 280 C 100 236 136 200 180 200 Z"
            fill="url(#logoAquaBack)"
            stroke="#0A3875"
            strokeWidth="6"
          />
          <path
            d="M 260 125 H 428 C 460 125 490 142 512 170 L 564 242"
            stroke="url(#logoAquaRim)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {activeOpen ? (
            <>
              <rect x="110" y="240" width="804" height="380" fill="#061A3A" opacity="0.7"/>

              <g transform="rotate(-3 512 380)">
                <path
                  d="M 240 130 H 640 L 770 260 V 680 C 770 702 752 720 730 720 H 240 C 218 720 200 702 200 680 V 170 C 200 148 218 130 240 130 Z"
                  fill="url(#logoDocGrad)"
                  stroke="#CBD5E1"
                  strokeWidth="4"
                />
                <path d="M 640 130 V 246 C 640 260 652 270 666 270 H 770 Z" fill="#94A3B8"/>
                <rect x="250" y="270" width="460" height="16" rx="8" fill="#1E88E5" opacity="0.8"/>
                <rect x="250" y="304" width="380" height="14" rx="7" fill="#64B5F6" opacity="0.6"/>
              </g>

              <path
                d="M 136 470 C 136 444 158 424 192 424 H 832 C 866 424 888 444 888 470 L 924 790 C 928 844 892 880 844 880 H 180 C 132 880 96 844 100 790 Z"
                fill="url(#logoAquaFront)"
                stroke="#0A3875"
                strokeWidth="7"
              />
              <path d="M 190 428 H 834" stroke="url(#logoFrontGloss)" strokeWidth="10" strokeLinecap="round"/>
            </>
          ) : (
            <>
              <path
                d="M 180 360 H 844 C 888 360 924 396 924 440 V 800 C 924 844 888 880 844 880 H 180 C 136 880 100 844 100 800 V 440 C 100 396 136 360 180 360 Z"
                fill="url(#logoAquaFront)"
                stroke="#0A3875"
                strokeWidth="7"
              />
              <path d="M 180 364 H 844" stroke="url(#logoFrontGloss)" strokeWidth="10" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </div>

      {showTitle && (
        <span className="text-xs font-semibold text-[var(--mac-text-primary)] tracking-tight whitespace-nowrap">
          Anything File Manager
        </span>
      )}
    </div>
  );
};
