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
            {/* Premier Back Plate Gradient (Apple Emerald) */}
            <linearGradient id="afmBackPlate" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#014D4B"/>
              <stop offset="30%" stopColor="#026A66"/>
              <stop offset="70%" stopColor="#048A7B"/>
              <stop offset="100%" stopColor="#07B38C"/>
            </linearGradient>

            {/* Premier Front Flap Gradient */}
            <linearGradient id="afmFrontFlap" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#048A7B"/>
              <stop offset="45%" stopColor="#07BA90"/>
              <stop offset="100%" stopColor="#12E5A8"/>
            </linearGradient>

            {/* Metallic Gloss Lip */}
            <linearGradient id="afmLipGloss" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4"/>
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.95"/>
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.4"/>
            </linearGradient>

            {/* Inner Folder Cavity */}
            <linearGradient id="afmCavity" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#001F1E" stopOpacity="0.96"/>
              <stop offset="100%" stopColor="#024D46" stopOpacity="0.25"/>
            </linearGradient>
          </defs>

          {/* 1. Back Folder Plate */}
          <path d="
            M 190 190
            L 390 190
            C 445 190 475 215 515 275
            C 535 298 560 304 600 304
            L 834 304
            C 888 304 904 320 904 374
            L 904 786
            C 904 840 888 856 834 856
            L 190 856
            C 136 856 120 840 120 786
            L 120 260
            C 120 206 136 190 190 190
            Z
          " fill="url(#afmBackPlate)" stroke="#013A38" strokeWidth="6"/>

          {/* Top Tab Highlight */}
          <path d="M 190 194 L 388 194 C 440 194 470 218 510 278" stroke="rgba(255,255,255,0.4)" strokeWidth="6" strokeLinecap="round"/>

          {activeOpen ? (
            /* Open Folder State with Crisp White File Sheet */
            <>
              {/* Inner Cavity */}
              <rect x="124" y="304" width="776" height="340" fill="url(#afmCavity)"/>

              {/* Peeking Document Sheet */}
              <g transform="rotate(-3.5 512 380)">
                <path d="
                  M 250 130
                  L 640 130
                  L 770 260
                  L 770 660
                  C 770 678 756 692 738 692
                  L 250 692
                  C 232 692 218 678 218 660
                  L 218 162
                  C 218 144 232 130 250 130
                  Z
                " fill="#FFFFFF" stroke="#64748B" strokeWidth="5"/>
                <path d="M 640 130 L 640 242 C 640 256 652 260 666 260 L 770 260 Z" fill="#CBD5E1"/>
                <path d="M 640 130 L 770 260" stroke="#94A3B8" strokeWidth="4"/>
                <rect x="270" y="210" width="160" height="34" rx="17" fill="#048A7B"/>
                <polygon points="296,220 296,234 310,227" fill="#FFFFFF"/>
                <rect x="270" y="280" width="380" height="18" rx="9" fill="#64748B" opacity="0.65"/>
                <rect x="270" y="318" width="300" height="16" rx="8" fill="#94A3B8" opacity="0.5"/>
              </g>

              {/* Angled Front Flap (Open) */}
              <path d="
                M 150 490
                C 150 466 168 450 200 450
                L 824 450
                C 856 450 874 466 874 490
                L 908 786
                C 912 840 888 860 834 860
                L 190 860
                C 136 860 112 840 116 786
                Z
              " fill="url(#afmFrontFlap)" stroke="#035B54" strokeWidth="7"/>
              <path d="M 198 454 L 826 454" stroke="url(#afmLipGloss)" strokeWidth="9" strokeLinecap="round"/>
            </>
          ) : (
            /* Closed Folder State (Snug fit with crescent opening slit) */
            <>
              {/* Crescent Opening Slit */}
              <path d="
                M 132 400
                C 150 364 190 350 240 350
                L 784 350
                C 834 350 874 364 892 400
                C 874 376 834 364 784 364
                L 240 364
                C 190 364 150 376 132 400
                Z
              " fill="#FFFFFF" opacity="0.95"/>

              {/* Front Flap (Closed) */}
              <path d="
                M 190 380
                L 834 380
                C 888 380 904 396 904 450
                L 904 786
                C 904 840 888 856 834 856
                L 190 856
                C 136 856 120 840 120 786
                L 120 450
                C 120 396 136 380 190 380
                Z
              " fill="url(#afmFrontFlap)" stroke="#035B54" strokeWidth="7"/>
              <path d="M 190 384 L 834 384" stroke="url(#afmLipGloss)" strokeWidth="8" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </div>

      {showTitle && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[var(--mac-text-primary)] tracking-tight whitespace-nowrap">
              Anything File Manager
            </span>
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Pro
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
