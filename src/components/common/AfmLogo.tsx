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
          className="drop-shadow-sm transition-all duration-300"
        >
          <defs>
            <linearGradient id="afmBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF"/>
              <stop offset="100%" stop-color="#F3F6F8"/>
            </linearGradient>

            <linearGradient id="afmBackPlate" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#048C8A"/>
              <stop offset="50%" stop-color="#06A88E"/>
              <stop offset="100%" stop-color="#08BD93"/>
            </linearGradient>

            <linearGradient id="afmFrontFlap" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#07B38C"/>
              <stop offset="50%" stop-color="#09C496"/>
              <stop offset="100%" stop-color="#0FDCA3"/>
            </linearGradient>

            <linearGradient id="afmPocketCavity" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#023D3A" stop-opacity="0.8"/>
              <stop offset="100%" stop-color="#03665F" stop-opacity="0.1"/>
            </linearGradient>
          </defs>

          {/* Squircle App Container */}
          <rect x="48" y="48" width="928" height="928" rx="216" fill="url(#afmBgGrad)"/>
          <rect x="48" y="48" width="928" height="928" rx="216" fill="none" stroke="#E2E8F0" stroke-width="4" opacity="0.6"/>

          {/* Back Folder Plate */}
          <path d="
            M 264 250
            L 410 250
            C 455 250 480 270 515 320
            C 530 338 550 342 580 342
            L 760 342
            C 804 342 814 352 814 396
            L 814 716
            C 814 760 804 770 760 770
            L 264 770
            C 220 770 210 760 210 716
            L 210 304
            C 210 260 220 250 264 250
            Z
          " fill="url(#afmBackPlate)"/>

          {activeOpen ? (
            /* Open Folder State with File Sheet Peeking Out */
            <>
              {/* Inner Cavity */}
              <rect x="210" y="342" width="604" height="260" fill="url(#afmPocketCavity)"/>

              {/* Peeking Document Sheet */}
              <g transform="rotate(-3 512 400)">
                <path d="
                  M 310 210
                  L 620 210
                  L 714 304
                  L 714 590
                  C 714 606 702 618 686 618
                  L 310 618
                  C 294 618 282 606 282 590
                  L 282 238
                  C 282 222 294 210 310 210
                  Z
                " fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
                <path d="M 620 210 L 620 290 C 620 302 630 304 642 304 L 714 304 Z" fill="#E2E8F0"/>
                <rect x="330" y="270" width="130" height="26" rx="13" fill="#07B38C" opacity="0.9"/>
                <polygon points="352,278 352,288 362,283" fill="#FFFFFF"/>
                <rect x="474" y="278" width="110" height="10" rx="5" fill="#07B38C" opacity="0.4"/>
                <rect x="330" y="330" width="310" height="12" rx="6" fill="#94A3B8" opacity="0.45"/>
                <rect x="330" y="360" width="270" height="10" rx="5" fill="#94A3B8" opacity="0.3"/>
              </g>

              {/* Angled Front Flap (Open) */}
              <path d="
                M 230 488
                C 230 468 244 456 268 456
                L 756 456
                C 780 456 794 468 794 488
                L 820 716
                C 824 760 804 774 760 774
                L 264 774
                C 220 774 200 760 204 716
                Z
              " fill="url(#afmFrontFlap)"/>
              <path d="M 268 458 L 756 458" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
            </>
          ) : (
            /* Closed Folder State (Snug fit with crescent opening slit) */
            <>
              {/* Crescent Opening Slit */}
              <path d="
                M 218 424
                C 230 398 255 388 290 388
                L 734 388
                C 769 388 794 398 806 424
                C 794 406 769 398 734 398
                L 290 398
                C 255 398 230 406 218 424
                Z
              " fill="#FFFFFF" opacity="0.95"/>

              {/* Front Flap (Closed) */}
              <path d="
                M 264 408
                L 760 408
                C 804 408 814 418 814 462
                L 814 716
                C 814 760 804 770 760 770
                L 264 770
                C 220 770 210 760 210 716
                L 210 462
                C 210 418 220 408 264 408
                Z
              " fill="url(#afmFrontFlap)"/>
              <path d="M 264 410 L 760 410" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
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
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              AFM
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
