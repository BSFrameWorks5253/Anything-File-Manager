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
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
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
            {/* Deep Dimension Back Plate Gradient */}
            <linearGradient id="afmBackGrad" x1="15%" y1="10%" x2="85%" y2="90%">
              <stop offset="0%" stopColor="#00E5A3"/>
              <stop offset="35%" stopColor="#00B4D8"/>
              <stop offset="70%" stopColor="#0077B6"/>
              <stop offset="100%" stopColor="#03045E"/>
            </linearGradient>

            {/* Glossy Rim Glow */}
            <linearGradient id="afmRimGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8"/>
              <stop offset="40%" stopColor="#64DFDF" stopOpacity="0.9"/>
              <stop offset="80%" stopColor="#00E5A3" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.5"/>
            </linearGradient>

            {/* Front Glass Visor Gradient */}
            <linearGradient id="afmFrontGlass" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stopColor="#00F5A0" stopOpacity="0.88"/>
              <stop offset="45%" stopColor="#00B4D8" stopOpacity="0.82"/>
              <stop offset="85%" stopColor="#0077B6" stopOpacity="0.92"/>
              <stop offset="100%" stopColor="#023E8A" stopOpacity="0.96"/>
            </linearGradient>

            {/* Glass Specular Highlight */}
            <linearGradient id="afmGlassGloss" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3"/>
              <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.95"/>
              <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3"/>
            </linearGradient>

            {/* Prism Sheet Gradient */}
            <linearGradient id="afmSheetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF"/>
              <stop offset="100%" stopColor="#E2E8F0"/>
            </linearGradient>

            {/* Secondary Hologram Sheet */}
            <linearGradient id="afmHoloSheet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7209B7"/>
              <stop offset="50%" stopColor="#4361EE"/>
              <stop offset="100%" stopColor="#4CC9F0"/>
            </linearGradient>

            {/* Play Button Gradient */}
            <linearGradient id="afmPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5A0"/>
              <stop offset="100%" stopColor="#00B4D8"/>
            </linearGradient>
          </defs>

          {/* 1. Main Folder Backplate */}
          <path d="
            M 190 190
            L 410 190
            C 455 190 480 220 520 280
            C 540 306 568 312 608 312
            L 834 312
            C 892 312 914 334 914 392
            L 914 786
            C 914 844 892 866 834 866
            L 190 866
            C 132 866 110 844 110 786
            L 110 270
            C 110 212 132 190 190 190
            Z
          " fill="url(#afmBackGrad)" stroke="#003554" strokeWidth="6"/>

          {/* Tab Rim Specular Light */}
          <path d="M 190 195 L 408 195 C 452 195 478 222 516 282" stroke="url(#afmRimGlow)" strokeWidth="7" strokeLinecap="round"/>

          {activeOpen ? (
            /* Open State */
            <>
              {/* Deep Inner Cavity */}
              <rect x="116" y="312" width="792" height="340" fill="#03071E" opacity="0.85"/>

              {/* Back Secondary Media Prism Sheet */}
              <g transform="rotate(7 512 400)">
                <rect x="360" y="160" width="460" height="490" rx="28" fill="url(#afmHoloSheet)" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="3"/>
                <rect x="390" y="200" width="180" height="20" rx="10" fill="#FFFFFF" opacity="0.6"/>
                <rect x="390" y="235" width="280" height="14" rx="7" fill="#FFFFFF" opacity="0.4"/>
              </g>

              {/* Primary Front High-Contrast Media Sheet */}
              <g transform="rotate(-3.5 512 390)">
                <path d="
                  M 240 140
                  L 620 140
                  L 760 280
                  L 760 670
                  C 760 690 744 706 724 706
                  L 240 706
                  C 220 706 204 690 204 670
                  L 204 176
                  C 204 156 220 140 240 140
                  Z
                " fill="url(#afmSheetGrad)" stroke="#CBD5E1" strokeWidth="4"/>
                <path d="M 620 140 L 620 256 C 620 270 632 280 646 280 L 760 280 Z" fill="#94A3B8"/>
                <path d="M 620 140 L 760 280" stroke="#64748B" strokeWidth="3"/>

                <rect x="256" y="212" width="180" height="40" rx="20" fill="url(#afmPlayGrad)"/>
                <polygon points="286,224 286,240 302,232" fill="#FFFFFF"/>

                <rect x="256" y="280" width="450" height="16" rx="8" fill="#0077B6" opacity="0.8"/>
                <rect x="256" y="312" width="360" height="14" rx="7" fill="#0096C7" opacity="0.5"/>
                <rect x="256" y="342" width="400" height="14" rx="7" fill="#48CAE4" opacity="0.4"/>

                {/* Waveform Visualizer Bars */}
                <g opacity="0.75" transform="translate(256, 380)">
                  <rect x="0" y="16" width="6" height="24" rx="3" fill="#00B4D8"/>
                  <rect x="14" y="8" width="6" height="32" rx="3" fill="#00B4D8"/>
                  <rect x="28" y="2" width="6" height="38" rx="3" fill="#00F5A0"/>
                  <rect x="42" y="12" width="6" height="28" rx="3" fill="#00B4D8"/>
                  <rect x="56" y="0" width="6" height="40" rx="3" fill="#00F5A0"/>
                  <rect x="70" y="18" width="6" height="22" rx="3" fill="#00B4D8"/>
                  <rect x="84" y="6" width="6" height="34" rx="3" fill="#00F5A0"/>
                  <rect x="98" y="14" width="6" height="26" rx="3" fill="#00B4D8"/>
                  <rect x="112" y="4" width="6" height="36" rx="3" fill="#00F5A0"/>
                </g>
              </g>

              {/* Angled Front Flap */}
              <path d="
                M 146 480
                C 146 454 166 436 200 436
                L 824 436
                C 858 436 878 454 878 480
                L 914 786
                C 918 844 892 866 834 866
                L 190 866
                C 132 866 106 844 110 786
                Z
              " fill="url(#afmFrontGlass)" stroke="#003554" strokeWidth="7"/>

              <path d="M 198 440 L 826 440" stroke="url(#afmGlassGloss)" strokeWidth="10" strokeLinecap="round"/>
              <path d="M 210 448 L 814 448" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round"/>

              {/* Center AFM Emblem */}
              <g transform="translate(512, 650)">
                <circle cx="0" cy="0" r="74" fill="#03045E" stroke="url(#afmRimGlow)" strokeWidth="4" opacity="0.9"/>
                <path d="M -30 38 L 0 -38 L 30 38 L 12 38 L 0 8 L -12 38 Z" fill="url(#afmPlayGrad)"/>
                <circle cx="0" cy="3" r="5" fill="#FFFFFF"/>
              </g>
            </>
          ) : (
            /* Closed State */
            <>
              {/* Crescent Inset */}
              <path d="
                M 130 388
                C 152 352 195 336 248 336
                L 776 336
                C 829 336 872 352 894 388
                C 872 364 829 350 776 350
                L 248 350
                C 195 350 152 364 130 388
                Z
              " fill="#FFFFFF" opacity="0.9"/>

              <path d="
                M 190 364
                L 834 364
                C 892 364 914 382 914 440
                L 914 786
                C 914 844 892 866 834 866
                L 190 866
                C 132 866 110 844 110 786
                L 110 440
                C 110 382 132 364 190 364
                Z
              " fill="url(#afmFrontGlass)" stroke="#003554" strokeWidth="7"/>

              <path d="M 190 368 L 834 368" stroke="url(#afmGlassGloss)" strokeWidth="10" strokeLinecap="round"/>
              <path d="M 210 376 L 814 376" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round"/>

              <g transform="translate(512, 615)">
                <circle cx="0" cy="0" r="82" fill="#03045E" stroke="url(#afmRimGlow)" strokeWidth="4.5" opacity="0.9"/>
                <path d="M -34 42 L 0 -42 L 34 42 L 14 42 L 0 8 L -14 42 Z" fill="url(#afmPlayGrad)"/>
                <circle cx="0" cy="3" r="6" fill="#FFFFFF"/>
              </g>
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
