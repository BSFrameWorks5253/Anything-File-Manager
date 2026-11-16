export interface LutPreset {
  id: string;
  name: string;
  shortLabel: string;
  camera: string;
  cssFilter: string;
  svgFilterId?: string;
  description: string;
}

export const LUT_PRESETS: LutPreset[] = [
  {
    id: 'off',
    name: 'Off (Native LOG / Untouched)',
    shortLabel: 'LOG',
    camera: 'Raw Footage',
    cssFilter: 'none',
    description: 'Displays footage straight out of camera without any color or contrast correction.'
  },
  {
    id: 'slog3',
    name: 'Sony S-Log3 → Rec.709',
    shortLabel: 'S-Log3',
    camera: 'Sony FX3 / FX6 / A7S III / A7 IV',
    cssFilter: 'contrast(1.58) brightness(0.93) saturate(1.48)',
    svgFilterId: 'afm-lut-slog3',
    description: 'Standard Sony S-Gamut3.Cine / S-Log3 to Rec.709 conversion expanding dynamic contrast and color saturation.'
  },
  {
    id: 'clog3',
    name: 'Canon C-Log3 → Rec.709',
    shortLabel: 'C-Log3',
    camera: 'Canon R5 / R5C / C70 / C300 Mk III',
    cssFilter: 'contrast(1.48) brightness(0.96) saturate(1.42)',
    svgFilterId: 'afm-lut-clog3',
    description: 'Canon Cinema Gamut / C-Log3 to Rec.709 curve with natural skin tones and rich midtones.'
  },
  {
    id: 'applelog',
    name: 'Apple Log → Rec.709',
    shortLabel: 'Apple Log',
    camera: 'iPhone 15 Pro / 16 Pro ProRes Log',
    cssFilter: 'contrast(1.52) brightness(0.94) saturate(1.40)',
    svgFilterId: 'afm-lut-applelog',
    description: 'Transforms Apple Log ProRes videos into vibrant, natural Rec.709 color balance.'
  },
  {
    id: 'dlog',
    name: 'DJI D-Log / D-Log M → Rec.709',
    shortLabel: 'DJI D-Log',
    camera: 'DJI Mavic 3 / Inspire 3 / Action 4 / Pocket 3',
    cssFilter: 'contrast(1.54) brightness(0.92) saturate(1.48)',
    svgFilterId: 'afm-lut-dlog',
    description: 'Recovers vibrant skies, lush greens, and deep contrast from flat aerial D-Log footage.'
  },
  {
    id: 'vlog',
    name: 'Panasonic V-Log → Rec.709',
    shortLabel: 'V-Log',
    camera: 'Panasonic S5 II / GH6 / S1H / EVA1',
    cssFilter: 'contrast(1.60) brightness(0.91) saturate(1.46)',
    svgFilterId: 'afm-lut-vlog',
    description: 'V-Log / V-Gamut conversion restoring natural contrast curve and true highlight roll-off.'
  },
  {
    id: 'punchy',
    name: 'Film Contrast Pop',
    shortLabel: 'Film Pop',
    camera: 'Universal Stylized',
    cssFilter: 'contrast(1.25) brightness(1.02) saturate(1.30)',
    description: 'Adds an extra rich cinematic pop to standard Rec.709 or slightly flat footage.'
  },
  {
    id: 'bw',
    name: 'High-Contrast B&W Noir',
    shortLabel: 'B&W',
    camera: 'Creative Monochrome',
    cssFilter: 'grayscale(1) contrast(1.45) brightness(0.95)',
    description: 'Classic rich black & white transformation for evaluating lighting and silhouette compositions.'
  }
];

export function getLutFilterStyle(lutId: string): React.CSSProperties {
  const preset = LUT_PRESETS.find(p => p.id === lutId) || LUT_PRESETS[0];
  if (!preset || preset.id === 'off') {
    return {};
  }
  return {
    filter: preset.cssFilter
  };
}
