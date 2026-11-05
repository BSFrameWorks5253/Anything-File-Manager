/**
 * Anything File Manager (AFM) — Taxonomy & Production Classification Engine
 *
 * Implements strict regular expression matching and token extraction for:
 * 1. Master Safar Folders: e.g. "1448-03 Mumbai", "1448-02 Raipur", "1448-10-Istefada ilmiyah"
 * 2. Date / Session Work Folders: e.g. "1448-03-13 _01M", "1448-05-07_01M", "1448-03-12 _02E"
 * 3. Item / Slot Folders (Format A with ITS): e.g. "1448-05-07_01M-01-01N-40905764", "1448-03-13 _01M-02-01AQ-30338708"
 * 4. Item / Slot Folders (Format B - No ITS / Hadiyah): e.g. "1448-03-13 _01M-05-H-", "1448-03-13 _01M-08-SP-"
 * 5. Event Category Folders: e.g. "01-Mumbai-Bethak", "02-Mumbai-Waaz"
 */

export type AfmFolderType = 'master_safar' | 'date_session' | 'slot_item_a' | 'slot_item_b' | 'category' | 'generic';

export type ProductionStage =
  | 'stage1'    // Stage 1: Raw Ingest (Blue)
  | 'stage2'    // Stage 2: Synced / MultiCam (Purple)
  | 'editing'   // In Editing (Amber)
  | 'review'    // Pending Review (Pink)
  | 'rendered'  // Rendered (Emerald)
  | 'uploaded'  // Uploaded (Cyan)
  | 'backedup'; // Backed Up / Archive (Slate)

export interface ProductionStageConfig {
  id: ProductionStage;
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const PRODUCTION_STAGES: Record<ProductionStage, ProductionStageConfig> = {
  stage1: {
    id: 'stage1',
    label: 'Stage 1: Raw Ingest',
    color: '#3B82F6',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30'
  },
  stage2: {
    id: 'stage2',
    label: 'Stage 2: Synced',
    color: '#8B5CF6',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30'
  },
  editing: {
    id: 'editing',
    label: 'In Editing',
    color: '#F59E0B',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30'
  },
  review: {
    id: 'review',
    label: 'Pending Review',
    color: '#EC4899',
    bgClass: 'bg-pink-500/15',
    textClass: 'text-pink-400',
    borderClass: 'border-pink-500/30'
  },
  rendered: {
    id: 'rendered',
    label: 'Rendered',
    color: '#10B981',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30'
  },
  uploaded: {
    id: 'uploaded',
    label: 'Uploaded',
    color: '#06B6D4',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30'
  },
  backedup: {
    id: 'backedup',
    label: 'Backed Up',
    color: '#64748B',
    bgClass: 'bg-slate-500/15',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30'
  }
};

export interface MasterSafarTokens {
  hijriYear: string;
  safarSerial: string;
  city: string;
  event?: string;
}

export interface DateSessionTokens {
  date: string;
  sessionIndex: string;
  sessionPeriod: 'M' | 'E'; // Morning/Maghrib vs Evening
}

export interface SlotItemTokens {
  session: string;
  slotNo: string;
  occurrence?: string;
  eventCode: string;
  its?: string | null;
}

export interface CategoryTokens {
  index: string;
  city: string;
  eventType: string;
}

export interface AfmFolderClassification {
  type: AfmFolderType;
  rawName: string;
  fullPath: string;
  masterTokens?: MasterSafarTokens;
  dateTokens?: DateSessionTokens;
  slotTokens?: SlotItemTokens;
  categoryTokens?: CategoryTokens;
  isValidIts?: boolean;
}

// ── REGEX CLASSIFIERS ──

// 1. Master Safar Folder: e.g. "1448-03 Mumbai", "1448-02 Raipur", "1448-05-08 Coimbatore", "1448-10-Istefada ilmiyah"
const MASTER_SAFAR_REGEX = /^(\d{4})[-_](\d{2})(?:[-_](\d{2}))?[\s\-_]+([A-Za-z\s]+)(?:-(.*))?$/;

// 2. Date / Session Work Folder: e.g. "1448-03-13 _01M", "1448-05-07_01M", "1448-03-12 _02E", "1448-05-09 _01M"
const DATE_SESSION_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2})\s*_?(\d{2})([ME])$/i;

// 3. Item / Slot Folder Format A (Full with session & ITS): e.g. "1448-05-07_01M-01-01N-40905764"
const SLOT_FORMAT_A_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{1,3}[a-zA-Z]?)-(?:(\d{1,3})?([A-Z]+))-(\d{5,8})$/i;

// 4. Item / Slot Folder Format B (Full without ITS): e.g. "1448-03-13 _01M-05-H-", "1448-05-09 _01M-01-Z", "1448-05-08 Coimbatore-01-Z"
const SLOT_FORMAT_B_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{1,3}[a-zA-Z]?)-([A-Z]+)-?$/i;
const SLOT_FORMAT_B_MASTER_PREFIX_REGEX = /^(\d{4}[-_]\d{2}(?:[-_]\d{2})?[\s\-_]+[A-Za-z\s]+)-(\d{1,3}[a-zA-Z]?)-([A-Za-z]+)-?$/i;

// 5. Short / Relative Slot Folders (inside Date Session): e.g. "01-01N-40905764", "02-01AQ-30338708", "01-Z", "05-H", "08-SP"
const SHORT_SLOT_A_REGEX = /^(\d{1,3}[a-zA-Z]?)-(?:(\d{1,3})?([A-Z]+))-(\d{5,8})$/i;
const SHORT_SLOT_B_REGEX = /^(\d{1,3}[a-zA-Z]?)-(?:(\d{1,3})?([A-Z]+))-?$/i;

// 6. Category Grouping Folder: e.g. "01-Mumbai-Bethak", "02-Mumbai-Waaz"
const CATEGORY_REGEX = /^(\d{2})-([A-Za-z]+)-([A-Za-z\s]+)$/;

/**
 * Classifies a folder name and extracts structured semantic tokens
 */
export function isSlotFolderName(name: string): boolean {
  const clean = name.trim();
  // 1. Explicit slot keyword (e.g. "Slot 1", "Slot-02", "Slot_A")
  if (/\bslot\b/i.test(clean)) return true;
  // 2. Format with session or date or master prefix + slot number + event code
  if (/[-_](\d{1,3}[a-zA-Z]?)[-_](?:(\d{1,3})?([A-Za-z]+))(?:[-_](\d{5,8}))?-?$/i.test(clean)) return true;
  // 3. Simple slot number + code (e.g. 01-Z, 05-H, 02-01A-30338708)
  if (/^(\d{1,3}[a-zA-Z]?)[-_](?:(\d{1,3})?([A-Za-z]+))(?:[-_](\d{5,8}))?-?$/i.test(clean)) return true;
  // 4. Slot format with city/safar prefix e.g. "1448-05-08 Coimbatore-01-Z"
  if (/^(\d{4}[-_]\d{2}(?:[-_]\d{2})?.*)[-_](\d{1,3}[a-zA-Z]?)[-_]([A-Za-z]+)-?$/i.test(clean)) return true;
  return false;
}

export function classifyFolder(name: string, fullPath: string = ''): AfmFolderClassification {
  const clean = name.trim();

  // Test 1: Full Slot Folder Format A (with ITS ID)
  const slotAMatch = clean.match(SLOT_FORMAT_A_REGEX);
  if (slotAMatch) {
    const its = slotAMatch[5];
    const isValidIts = /^\d{5,8}$/.test(its);
    return {
      type: 'slot_item_a',
      rawName: clean,
      fullPath,
      slotTokens: {
        session: slotAMatch[1],
        slotNo: slotAMatch[2],
        occurrence: slotAMatch[3] || '01',
        eventCode: slotAMatch[4].toUpperCase(),
        its
      },
      isValidIts
    };
  }

  // Test 2: Full Slot Folder Format B (No ITS / Hadiyah / Ziyafat)
  const slotBMatch = clean.match(SLOT_FORMAT_B_REGEX) || clean.match(SLOT_FORMAT_B_MASTER_PREFIX_REGEX);
  if (slotBMatch) {
    return {
      type: 'slot_item_b',
      rawName: clean,
      fullPath,
      slotTokens: {
        session: slotBMatch[1],
        slotNo: slotBMatch[2],
        eventCode: slotBMatch[3].toUpperCase(),
        its: null
      },
      isValidIts: true
    };
  }

  // Test 3: Short Slot Format A (e.g. 01-01N-40905764)
  const shortSlotAMatch = clean.match(SHORT_SLOT_A_REGEX);
  if (shortSlotAMatch) {
    const its = shortSlotAMatch[4];
    const isValidIts = /^\d{5,8}$/.test(its);
    return {
      type: 'slot_item_a',
      rawName: clean,
      fullPath,
      slotTokens: {
        session: '',
        slotNo: shortSlotAMatch[1],
        occurrence: shortSlotAMatch[2] || '01',
        eventCode: shortSlotAMatch[3].toUpperCase(),
        its
      },
      isValidIts
    };
  }

  // Test 4: Short Slot Format B (e.g. 01-Z, 05-H, 08-SP)
  const shortSlotBMatch = clean.match(SHORT_SLOT_B_REGEX);
  if (shortSlotBMatch) {
    return {
      type: 'slot_item_b',
      rawName: clean,
      fullPath,
      slotTokens: {
        session: '',
        slotNo: shortSlotBMatch[1],
        occurrence: shortSlotBMatch[2] || '01',
        eventCode: shortSlotBMatch[3].toUpperCase(),
        its: null
      },
      isValidIts: true
    };
  }

  // Test 4b: General Slot Heuristic (e.g. "1448-05-08 Coimbatore-01-Z", "1448-03-Slot 1", "Slot 1")
  if (isSlotFolderName(clean)) {
    return {
      type: 'slot_item_b',
      rawName: clean,
      fullPath,
      slotTokens: {
        session: '',
        slotNo: '01',
        eventCode: 'SLOT',
        its: null
      },
      isValidIts: true
    };
  }

  // Test 5: Date Session Folder (e.g. 1448-05-09 _01M)
  const dateMatch = clean.match(DATE_SESSION_REGEX);
  if (dateMatch) {
    return {
      type: 'date_session',
      rawName: clean,
      fullPath,
      dateTokens: {
        date: dateMatch[1].replace(/_/g, '-'),
        sessionIndex: dateMatch[2],
        sessionPeriod: dateMatch[3].toUpperCase() as 'M' | 'E'
      }
    };
  }

  // Test 6: Category Folder (e.g. 01-Mumbai-Bethak)
  const catMatch = clean.match(CATEGORY_REGEX);
  if (catMatch) {
    return {
      type: 'category',
      rawName: clean,
      fullPath,
      categoryTokens: {
        index: catMatch[1],
        city: catMatch[2],
        eventType: catMatch[3]
      }
    };
  }

  // Test 7: Master Safar Folder (e.g. 1448-05-08 Coimbatore, 1448-03 Mumbai)
  // Ensure it does not have session tokens or slot tokens
  if (!clean.includes('_01M') && !clean.includes('_02E') && !clean.includes('_01E') && !isSlotFolderName(clean)) {
    const masterMatch = clean.match(MASTER_SAFAR_REGEX);
    if (masterMatch) {
      return {
        type: 'master_safar',
        rawName: clean,
        fullPath,
        masterTokens: {
          hijriYear: masterMatch[1],
          safarSerial: masterMatch[2],
          city: (masterMatch[4] || masterMatch[3] || '').trim(),
          event: masterMatch[5]?.trim()
        }
      };
    }
  }

  return {
    type: 'generic',
    rawName: clean,
    fullPath
  };
}

/**
 * Validates ITS digits (5 to 8 digits required)
 */
export function validateIts(its: string | null | undefined): boolean {
  if (!its) return false;
  return /^\d{5,8}$/.test(its.trim());
}

/**
 * Format total seconds into HH:MM:SS
 */
export function formatCumulativeDuration(totalSecs: number): string {
  if (!isFinite(totalSecs) || totalSecs <= 0) return '00:00:00';
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = Math.floor(totalSecs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
  }
  return `${pad(mins)}m ${pad(secs)}s`;
}
