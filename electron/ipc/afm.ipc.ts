import { ipcMain, app, shell, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import zlib from 'zlib';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// ── ONE TAP COMPANION SYSTEM HELPERS ──
function getOneTapDb(): any | null {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const appData = process.env.APPDATA || '';
    const dbPath = path.join(appData, 'One Tap', 'tracker.db');
    if (fs.existsSync(dbPath)) {
      return new DatabaseSync(dbPath);
    }
  } catch (err) {
    console.warn('[AFM OneTap] SQLite access note:', err);
  }
  return null;
}

function getOneTapPythonScript(scriptName: string): string | null {
  const candidates = [
    path.join('C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything Apps\\One Tap\\src\\main\\python', scriptName),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'resources', 'python', scriptName),
    path.join(app.getAppPath(), '..', 'One Tap', 'src', 'main', 'python', scriptName),
    path.join(__dirname, '../../../../One Tap/src/main/python', scriptName)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// Supported Media Extensions
const VIDEO_EXTS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'mts', 'm2ts', 'mxf', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'braw', 'crm', 'r3d'
]);

const PHOTO_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'webp', 'tiff', 'tif'
]);

const SYSTEM_IGNORE_FOLDERS = new Set([
  '.git', '.trash', '$recycle.bin', 'system volume information',
  'adobe premiere pro auto-save', 'thumb', 'thumbs', 'thumbnail', 'thumbnails',
  'preview', 'previews', 'proxy', 'proxies', 'pxd', 'cache', 'node_modules'
]);

// ── REGEX PATTERNS FOR CLASSIFICATION ──
const MASTER_SAFAR_REGEX = /^(\d{4})[-_](\d{2})\s+([A-Za-z\s]+)(?:-(.*))?$/;
const DATE_SESSION_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2})\s*_(\d{2})([ME])$/i;
const SLOT_FORMAT_A_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{2})-(?:(\d{2})?([A-Z]+))-(\d{5,8})$/i;
const SLOT_FORMAT_B_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{2})-([A-Z]+)-?$/i;
const CATEGORY_REGEX = /^(\d{2})-([A-Za-z]+)-([A-Za-z\s]+)$/;

export type ProductionStage =
  | 'stage1'
  | 'stage2'
  | 'editing'
  | 'review'
  | 'rendered'
  | 'uploaded'
  | 'backedup';

interface AfmMetadata {
  stage: ProductionStage;
  notes?: string;
  lastUpdated: number;
}

export interface SlotBreakdownItem {
  slotFolder: string;
  slotPath: string;
  slotNo: string;
  eventCode: string;
  its: string | null;
  isValidIts: boolean;
  personName: string;
  clipCount: number;
  duration: number; // in seconds
  size: number;     // in bytes
}

export interface DateBreakdownItem {
  dateFolder: string;
  datePath: string;
  dateLabel: string;
  itemCount: number;
  clipCount: number;
  duration: number;
  size: number;
  stage: ProductionStage;
  prprojExists: boolean;
}

export interface AfmFolderAnalytics {
  folderType: 'master_safar' | 'date_session' | 'slot_item_a' | 'slot_item_b' | 'category' | 'generic';
  folderName: string;
  folderPath: string;
  stage: ProductionStage;
  // Summary Aggregates
  subfolderCount: number;
  videoClipCount: number;
  stillPhotoCount: number;
  totalStorageBytes: number;
  cumulativeDurationSeconds: number;
  // Prproj status
  hasPrproj: boolean;
  prprojName?: string;
  // Breakdowns
  slots: SlotBreakdownItem[];
  dates: DateBreakdownItem[];
  duplicateItsList: string[];
  malformedItsList: string[];
}

/**
 * Fast video duration lookup with ffprobe & caching
 */
const durationCache = new Map<string, number>();

async function getFastVideoDuration(filePath: string): Promise<number> {
  try {
    const stat = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`;
    if (durationCache.has(cacheKey)) {
      return durationCache.get(cacheKey)!;
    }

    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 3500 }
    );
    const parsed = parseFloat(stdout.trim());
    if (isFinite(parsed) && parsed > 0) {
      durationCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {}
  return 0;
}

/**
 * Read or auto-infer .afm_meta.json
 */
function getOrInferMetadata(dirPath: string): AfmMetadata {
  const metaFile = path.join(dirPath, '.afm_meta.json');
  try {
    if (fs.existsSync(metaFile)) {
      const data = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (data && data.stage) {
        return data as AfmMetadata;
      }
    }
  } catch {}

  // Auto-inference heuristic
  let inferredStage: ProductionStage = 'stage1';
  try {
    const list = fs.readdirSync(dirPath);
    const hasFinalExport = list.some(f => f.toLowerCase() === 'final' || f.toLowerCase() === 'renders');
    const hasPrproj = list.some(f => f.toLowerCase().endsWith('.prproj'));
    const hasXml = list.some(f => f.toLowerCase().endsWith('.xml'));

    if (hasFinalExport) {
      const finalDir = path.join(dirPath, 'Final');
      if (fs.existsSync(finalDir)) {
        const renders = fs.readdirSync(finalDir);
        if (renders.some(f => f.toLowerCase().endsWith('.mp4'))) {
          inferredStage = 'rendered';
        }
      }
    } else if (hasPrproj) {
      inferredStage = 'editing';
    } else if (hasXml) {
      inferredStage = 'stage2';
    }
  } catch {}

  return {
    stage: inferredStage,
    lastUpdated: Date.now()
  };
}

interface AfmVideoStreamInfo {
  width: number;
  height: number;
  duration: number;
  fpsNum: number;
  fpsDen: number;
  fps: number;
  timebase: number;
  ntsc: boolean;
  audioChannels: number;
  nbFrames: number;
  isValid: boolean;
}

const afmFfprobeCache = new Map<string, AfmVideoStreamInfo>();

function findFfprobeBinary(): string {
  const candidates = [
    'C:\\Users\\Burhanuddin\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffprobe.exe',
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything Apps\\One Tap\\tools\\ffprobe.exe',
    path.join(process.cwd(), 'tools', 'ffprobe.exe'),
    path.join(app.getAppPath(), 'tools', 'ffprobe.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'resources', 'tools', 'ffprobe.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'tools', 'ffprobe.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffprobe';
}

function pathToPathUrl(filePath: string): string {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return 'file://localhost/' + encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

function buildPrprojBuffer(folderName: string): Buffer {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
	<Project ObjectRef="1"/>
	<Project id="1" ClassID="9fd8536f-e3c3-4d76-8809-e855734e5a9c" Version="38">
		<Node Version="1">
			<Properties Version="1">
				<ProjectName>${escapeXml(folderName)}</ProjectName>
				<ProjectID>00000000-0000-0000-0000-000000000001</ProjectID>
			</Properties>
		</Node>
		<RootProjectItem ObjectRef="2"/>
	</Project>
	<RootProjectGroup id="2" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>Root</Name>
			</Properties>
		</Node>
		<Items Version="1">
			<Item Index="0" ObjectRef="3"/>
			<Item Index="1" ObjectRef="4"/>
			<Item Index="2" ObjectRef="5"/>
			<Item Index="3" ObjectRef="6"/>
		</Items>
	</RootProjectGroup>
	<ProjectItem id="3" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>01 RAW FOOTAGE</Name>
			</Properties>
		</Node>
	</ProjectItem>
	<ProjectItem id="4" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>02 SEQUENCES</Name>
			</Properties>
		</Node>
	</ProjectItem>
	<ProjectItem id="5" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>03 AUDIO &amp; MUSIC</Name>
			</Properties>
		</Node>
	</ProjectItem>
	<ProjectItem id="6" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>04 GRAPHICS &amp; TITLES</Name>
			</Properties>
		</Node>
	</ProjectItem>
</PremiereData>`;
  return zlib.gzipSync(Buffer.from(xmlContent, 'utf8'));
}

async function getVideoInfoNodeAsync(filePath: string): Promise<AfmVideoStreamInfo> {
  const FALLBACK_RES: AfmVideoStreamInfo = {
    width: 1920,
    height: 1080,
    duration: 10.0,
    fpsNum: 30,
    fpsDen: 1,
    fps: 30,
    timebase: 30,
    ntsc: false,
    audioChannels: 2,
    nbFrames: 300,
    isValid: true
  };

  try {
    if (!filePath || typeof filePath !== 'string') return FALLBACK_RES;
    const fileName = path.basename(filePath);
    if (fileName.startsWith('.') || fileName.startsWith('~')) {
      return { ...FALLBACK_RES, isValid: false };
    }
    const stat = fs.statSync(filePath);
    if (stat.size <= 0) return { ...FALLBACK_RES, isValid: false };

    const cacheKey = `${filePath}_${stat.mtimeMs}_${stat.size}`;
    if (afmFfprobeCache.has(cacheKey)) {
      return afmFfprobeCache.get(cacheKey)!;
    }

    const ffprobeExe = findFfprobeBinary();

    return new Promise((resolve) => {
      execFile(
        ffprobeExe,
        [
          '-v', 'error',
          '-show_entries', 'stream=width,height,duration,nb_frames,r_frame_rate,avg_frame_rate,channels,codec_type:format=duration',
          '-of', 'json',
          filePath
        ],
        { windowsHide: true, timeout: 15000 },
        (error, stdout) => {
          if (error || !stdout) {
            afmFfprobeCache.set(cacheKey, FALLBACK_RES);
            return resolve(FALLBACK_RES);
          }
          try {
            const parsed = JSON.parse(stdout);
            const streams = parsed.streams || [];
            const s = streams.find((st: any) => st.codec_type === 'video');
            const a = streams.find((st: any) => st.codec_type === 'audio');
            const f = parsed.format;

            const audioChannels = parseInt(a?.channels) || 2;
            const width = parseInt(s?.width) || 1920;
            const height = parseInt(s?.height) || 1080;

            const rateStr = (s?.r_frame_rate && s.r_frame_rate !== '0/0') ? s.r_frame_rate : (s?.avg_frame_rate || '30/1');
            const parts = rateStr.split('/');
            let num = parseInt(parts[0]) || 30;
            let den = parseInt(parts[1]) || 1;
            let rawFps = den > 0 ? num / den : 30;
            if (rawFps <= 0 || !isFinite(rawFps)) rawFps = 30;

            const nbFrames = parseInt(s?.nb_frames) || 0;
            let durSec = (nbFrames > 0 && rawFps > 0) ? (nbFrames / rawFps) : parseFloat(s?.duration);
            if (isNaN(durSec) || durSec <= 0) durSec = parseFloat(f?.duration);
            if (isNaN(durSec) || durSec <= 0) durSec = 10.0;
            const duration = Math.max(durSec, 0.1);

            let timebase = 30;
            let ntsc = false;

            if (Math.abs(rawFps - 23.976) < 0.1 || Math.abs(rawFps - 23.98) < 0.1 || (num === 24000 && den === 1001)) {
              timebase = 24; ntsc = true;
            } else if (Math.abs(rawFps - 24) < 0.1) {
              timebase = 24; ntsc = false;
            } else if (Math.abs(rawFps - 25) < 0.1) {
              timebase = 25; ntsc = false;
            } else if (Math.abs(rawFps - 29.97) < 0.1 || (num === 30000 && den === 1001)) {
              timebase = 30; ntsc = true;
            } else if (Math.abs(rawFps - 30) < 0.1) {
              timebase = 30; ntsc = false;
            } else if (Math.abs(rawFps - 50) < 0.1) {
              timebase = 50; ntsc = false;
            } else if (Math.abs(rawFps - 59.94) < 0.1 || (num === 60000 && den === 1001)) {
              timebase = 60; ntsc = true;
            } else if (Math.abs(rawFps - 60) < 0.1) {
              timebase = 60; ntsc = false;
            } else {
              timebase = Math.round(rawFps) || 30;
              ntsc = false;
            }

            const res: AfmVideoStreamInfo = {
              width, height, duration, fpsNum: num, fpsDen: den, fps: rawFps, timebase, ntsc, audioChannels, nbFrames, isValid: true
            };
            afmFfprobeCache.set(cacheKey, res);
            return resolve(res);
          } catch {
            afmFfprobeCache.set(cacheKey, FALLBACK_RES);
            return resolve(FALLBACK_RES);
          }
        }
      );
    });
  } catch {
    return FALLBACK_RES;
  }
}

export function registerAfmIPC(): void {
  /**
   * 1. Analyze Production Folder & Calculate Metrics
   */
  ipcMain.handle('afm:analyzeFolder', async (_event, folderPath: string): Promise<AfmFolderAnalytics | null> => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return null;
      const folderName = path.basename(folderPath);

      // Determine classification
      let folderType: AfmFolderAnalytics['folderType'] = 'generic';
      if (MASTER_SAFAR_REGEX.test(folderName)) folderType = 'master_safar';
      else if (DATE_SESSION_REGEX.test(folderName)) folderType = 'date_session';
      else if (SLOT_FORMAT_A_REGEX.test(folderName)) folderType = 'slot_item_a';
      else if (SLOT_FORMAT_B_REGEX.test(folderName)) folderType = 'slot_item_b';
      else if (CATEGORY_REGEX.test(folderName)) folderType = 'category';

      const meta = getOrInferMetadata(folderPath);

      let subfolderCount = 0;
      let videoClipCount = 0;
      let stillPhotoCount = 0;
      let totalStorageBytes = 0;
      let cumulativeDurationSeconds = 0;
      let hasPrproj = false;
      let prprojName: string | undefined;

      const slots: SlotBreakdownItem[] = [];
      const dates: DateBreakdownItem[] = [];
      const itsSeen = new Map<string, string[]>(); // its -> [slotPath]
      const malformedItsList: string[] = [];

      // ── Scenarios Based on Folder Hierarchy ──

      if (folderType === 'master_safar') {
        // Scans all Date Sessions inside Master Safar
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });

        for (const e of entries) {
          if (!e.isDirectory()) continue;
          if (SYSTEM_IGNORE_FOLDERS.has(e.name.toLowerCase())) continue;
          if (e.name.toLowerCase() === 'final') continue;

          subfolderCount++;
          const datePath = path.join(folderPath, e.name);

          // Deep scan date folder for video clips & stats
          let dateVideos = 0;
          let dateItems = 0;
          let dateBytes = 0;
          let dateSecs = 0;
          let datePrproj = false;

          const dateEntries = fs.readdirSync(datePath, { withFileTypes: true });
          for (const de of dateEntries) {
            if (de.isDirectory()) {
              if (SYSTEM_IGNORE_FOLDERS.has(de.name.toLowerCase()) || de.name.toLowerCase() === 'dvd') continue;
              dateItems++;
              // scan inside slots
              const slotPath = path.join(datePath, de.name);
              try {
                const slotSubs = fs.readdirSync(slotPath, { withFileTypes: true });
                for (const sub of slotSubs) {
                  const targetScanDir = sub.isDirectory() ? path.join(slotPath, sub.name) : slotPath;
                  const files = sub.isDirectory() ? fs.readdirSync(targetScanDir) : [sub.name];
                  for (const f of files) {
                    const ext = path.extname(f).toLowerCase().replace('.', '');
                    const fp = path.join(targetScanDir, f);
                    try {
                      const stat = fs.statSync(fp);
                      dateBytes += stat.size;
                      if (VIDEO_EXTS.has(ext)) {
                        dateVideos++;
                        const dur = await getFastVideoDuration(fp);
                        dateSecs += dur;
                      } else if (PHOTO_EXTS.has(ext)) {
                        stillPhotoCount++;
                      }
                    } catch {}
                  }
                  if (!sub.isDirectory()) break; // already read
                }
              } catch {}
            } else {
              const ext = path.extname(de.name).toLowerCase().replace('.', '');
              if (ext === 'prproj') datePrproj = true;
              try {
                const stat = fs.statSync(path.join(datePath, de.name));
                dateBytes += stat.size;
              } catch {}
            }
          }

          videoClipCount += dateVideos;
          totalStorageBytes += dateBytes;
          cumulativeDurationSeconds += dateSecs;

          const dateMeta = getOrInferMetadata(datePath);
          dates.push({
            dateFolder: e.name,
            datePath,
            dateLabel: e.name,
            itemCount: dateItems,
            clipCount: dateVideos,
            duration: Math.round(dateSecs * 10) / 10,
            size: dateBytes,
            stage: dateMeta.stage,
            prprojExists: datePrproj
          });
        }
      } else if (folderType === 'date_session' || folderType === 'category') {
        // Scans all Item / Slot Folders within Date Session
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });

        // Find .prproj in date folder
        for (const e of entries) {
          if (!e.isDirectory() && e.name.toLowerCase().endsWith('.prproj')) {
            hasPrproj = true;
            prprojName = e.name;
          }
        }

        // Helper to inspect a single slot
        const processSlot = async (slotName: string, slotPath: string) => {
          subfolderCount++;
          let slotClips = 0;
          let slotBytes = 0;
          let slotSecs = 0;
          let personName = '—';

          // Extract slot tokens
          const matchA = slotName.match(SLOT_FORMAT_A_REGEX);
          const matchB = slotName.match(SLOT_FORMAT_B_REGEX);
          let slotNo = '00';
          let eventCode = 'GEN';
          let its: string | null = null;
          let isValidIts = true;

          if (matchA) {
            slotNo = matchA[2];
            eventCode = matchA[4]?.toUpperCase() || 'GEN';
            its = matchA[5];
            isValidIts = /^\d{5,8}$/.test(its);
            if (!isValidIts) malformedItsList.push(its);
            if (its) {
              const prev = itsSeen.get(its) || [];
              prev.push(slotName);
              itsSeen.set(its, prev);
            }
          } else if (matchB) {
            slotNo = matchB[2];
            eventCode = matchB[3]?.toUpperCase() || 'H';
            its = null;
          }

          try {
            const slotSubs = fs.readdirSync(slotPath, { withFileTypes: true });
            for (const sub of slotSubs) {
              if (sub.isDirectory() && !SYSTEM_IGNORE_FOLDERS.has(sub.name.toLowerCase())) {
                personName = sub.name; // Level 5 Person Name Folder
                const personDir = path.join(slotPath, sub.name);
                const mediaFiles = fs.readdirSync(personDir);
                for (const mf of mediaFiles) {
                  const ext = path.extname(mf).toLowerCase().replace('.', '');
                  const mfp = path.join(personDir, mf);
                  try {
                    const stat = fs.statSync(mfp);
                    slotBytes += stat.size;
                    if (VIDEO_EXTS.has(ext)) {
                      slotClips++;
                      const dur = await getFastVideoDuration(mfp);
                      slotSecs += dur;
                    } else if (PHOTO_EXTS.has(ext)) {
                      stillPhotoCount++;
                    }
                  } catch {}
                }
              } else if (!sub.isDirectory()) {
                const ext = path.extname(sub.name).toLowerCase().replace('.', '');
                const sfp = path.join(slotPath, sub.name);
                try {
                  const stat = fs.statSync(sfp);
                  slotBytes += stat.size;
                  if (VIDEO_EXTS.has(ext)) {
                    slotClips++;
                    const dur = await getFastVideoDuration(sfp);
                    slotSecs += dur;
                  } else if (PHOTO_EXTS.has(ext)) {
                    stillPhotoCount++;
                  }
                } catch {}
              }
            }
          } catch {}

          videoClipCount += slotClips;
          totalStorageBytes += slotBytes;
          cumulativeDurationSeconds += slotSecs;

          slots.push({
            slotFolder: slotName,
            slotPath,
            slotNo,
            eventCode,
            its,
            isValidIts,
            personName,
            clipCount: slotClips,
            duration: Math.round(slotSecs * 10) / 10,
            size: slotBytes
          });
        };

        for (const e of entries) {
          if (!e.isDirectory()) continue;
          if (SYSTEM_IGNORE_FOLDERS.has(e.name.toLowerCase()) || e.name.toLowerCase() === 'dvd') continue;

          const childPath = path.join(folderPath, e.name);

          // If child is a category folder (e.g. 01-Mumbai-Bethak), traverse it
          if (CATEGORY_REGEX.test(e.name)) {
            const nested = fs.readdirSync(childPath, { withFileTypes: true });
            for (const ne of nested) {
              if (ne.isDirectory()) {
                await processSlot(ne.name, path.join(childPath, ne.name));
              }
            }
          } else {
            await processSlot(e.name, childPath);
          }
        }
      } else {
        // Generic or single slot folder
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const e of entries) {
          const fp = path.join(folderPath, e.name);
          if (e.isDirectory()) {
            subfolderCount++;
          } else {
            const ext = path.extname(e.name).toLowerCase().replace('.', '');
            try {
              const stat = fs.statSync(fp);
              totalStorageBytes += stat.size;
              if (VIDEO_EXTS.has(ext)) {
                videoClipCount++;
                const dur = await getFastVideoDuration(fp);
                cumulativeDurationSeconds += dur;
              } else if (PHOTO_EXTS.has(ext)) {
                stillPhotoCount++;
              }
            } catch {}
          }
        }
      }

      // Check for duplicate ITS numbers
      const duplicateItsList: string[] = [];
      for (const [itsVal, list] of itsSeen.entries()) {
        if (list.length > 1) {
          duplicateItsList.push(itsVal);
        }
      }

      return {
        folderType,
        folderName,
        folderPath,
        stage: meta.stage,
        subfolderCount,
        videoClipCount,
        stillPhotoCount,
        totalStorageBytes,
        cumulativeDurationSeconds: Math.round(cumulativeDurationSeconds * 10) / 10,
        hasPrproj,
        prprojName,
        slots,
        dates,
        duplicateItsList,
        malformedItsList
      };
    } catch (err) {
      console.error('[afm:analyzeFolder] Error:', err);
      return null;
    }
  });

  /**
   * 2. Set Production Stage Tag & Sync with One Tap Task Tracker DB
   */
  ipcMain.handle('afm:setStage', async (_event, folderPath: string, stage: ProductionStage): Promise<boolean> => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return false;
      const metaFile = path.join(folderPath, '.afm_meta.json');
      const existing = getOrInferMetadata(folderPath);
      const oldStage = existing.stage || 'stage1';
      const now = Date.now();
      const updated: AfmMetadata = {
        ...existing,
        stage,
        lastUpdated: now
      };
      fs.writeFileSync(metaFile, JSON.stringify(updated, null, 2), 'utf8');

      // Inter-app sync: Record transition in One Tap's tracker.db if available
      try {
        const db = getOneTapDb();
        if (db) {
          const dateFolder = path.basename(folderPath);
          const parentDir = path.dirname(folderPath);
          const safarName = path.basename(parentDir);

          const selectStmt = db.prepare('SELECT id FROM tracker_tasks WHERE date_folder = ? LIMIT 1');
          const row: any = selectStmt.get(dateFolder);

          let taskId: number = 0;
          if (row && row.id) {
            taskId = row.id;
            const updateStmt = db.prepare('UPDATE tracker_tasks SET status = ?, updated_at = ? WHERE id = ?');
            updateStmt.run(stage, now, taskId);
          } else {
            const insertStmt = db.prepare(
              'INSERT INTO tracker_tasks (safar_name, date_folder, status, working_path, updated_at, first_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
            );
            const res: any = insertStmt.run(safarName, dateFolder, stage, folderPath, now, now);
            taskId = Number(res.lastInsertRowid || 0);
          }

          const historyStmt = db.prepare(
            'INSERT INTO tracker_history_logs (task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          historyStmt.run(
            taskId,
            safarName,
            dateFolder,
            oldStage,
            stage,
            `Stage updated to ${stage} via Anything File Manager`,
            now
          );
          db.close();
        }
      } catch (dbErr) {
        console.warn('[afm:setStage] Note: Could not sync to One Tap tracker.db:', dbErr);
      }

      return true;
    } catch (err) {
      console.error('[afm:setStage] Error:', err);
      return false;
    }
  });

  /**
   * 3. Generate Adobe Premiere Pro Project (.prproj / XML)
   * Fully synchronized with One Tap's frame-accurate, zero-overshoot engine:
   * - Native FCP XML + gzipped .prproj creation
   * - Exact nb_frames alignment & floor calculations (no audio priming overshoot)
   * - No synthetic <timecode> in <file> (prevents Premiere Pro black clips / disappearing footage)
   * - Video-Audio <link> bonding across V1 and A1
   * - Subfolder timeline markers for session slots
   */
  ipcMain.handle(
    'afm:generatePremiereProject',
    async (
      _event,
      payload: {
        folderPath: string;
        projectName: string;
        resolution: '1080p' | '4k';
        fps: number;
        openAfterCreate: boolean;
      }
    ): Promise<{ ok: boolean; prprojPath?: string; xmlPath?: string; error?: string }> => {
      try {
        const { folderPath, projectName, resolution, fps, openAfterCreate } = payload;
        if (!folderPath || !fs.existsSync(folderPath)) {
          return { ok: false, error: 'Target directory not found' };
        }

        const width = resolution === '4k' ? 3840 : 1920;
        const height = resolution === '4k' ? 2160 : 1080;
        const requestedFps = fps || 25;

        // Collect all video files with their subfolder context
        interface RawClipEntry {
          name: string;
          fullPath: string;
          subfolder: string;
        }
        const rawClips: RawClipEntry[] = [];

        const scanClips = (dir: string, currentSubfolder: string) => {
          const list = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of list) {
            const p = path.join(dir, item.name);
            if (item.isDirectory() && !SYSTEM_IGNORE_FOLDERS.has(item.name.toLowerCase())) {
              const sub = currentSubfolder ? `${currentSubfolder}/${item.name}` : item.name;
              scanClips(p, sub);
            } else if (!item.isDirectory()) {
              const ext = path.extname(item.name).toLowerCase().replace('.', '');
              if (VIDEO_EXTS.has(ext)) {
                rawClips.push({
                  name: item.name,
                  fullPath: p,
                  subfolder: currentSubfolder
                });
              }
            }
          }
        };

        scanClips(folderPath, '');

        if (rawClips.length === 0) {
          return { ok: false, error: 'No supported video clips found in the selected folder.' };
        }

        // Sort naturally by filename
        rawClips.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        // Probe each clip with full stream accuracy
        const probedInfos: AfmVideoStreamInfo[] = [];
        for (const clip of rawClips) {
          const info = await getVideoInfoNodeAsync(clip.fullPath);
          probedInfos.push(info);
        }

        // Determine master sequence settings
        const firstValid = probedInfos.find(i => i.isValid && i.duration > 0);
        const seqTb = requestedFps || (firstValid ? firstValid.timebase : 25);
        const seqNtscStr = (firstValid && firstValid.ntsc) ? 'TRUE' : 'FALSE';
        const seqWidth = firstValid ? firstValid.width : width;
        const seqHeight = firstValid ? firstValid.height : height;

        let currentFrame = 0;
        let vClipsXml = '';
        let aClipsXml = '';
        let markersXml = '';
        let currentMarkerKey = '';
        let audioTrackClipCount = 0;

        for (let idx = 0; idx < rawClips.length; idx++) {
          const clip = rawClips[idx];
          const info = probedInfos[idx];
          const clipFramesOnTimeline = (info.timebase === seqTb && info.nbFrames && info.nbFrames > 0)
            ? info.nbFrames
            : Math.max(1, Math.floor(info.duration * seqTb));

          const fileId = `file-${idx + 1}`;
          const masterId = `masterclip-${idx + 1}`;
          const vClipId = `vclip-${idx + 1}`;
          const aClipId = `aclip-${idx + 1}`;
          const startFrame = currentFrame;
          const endFrame = startFrame + clipFramesOnTimeline;
          const pathUrlStr = pathToPathUrl(clip.fullPath);

          // Subfolder timeline markers
          const markerName = clip.subfolder || path.basename(folderPath);
          if (markerName && markerName !== currentMarkerKey) {
            currentMarkerKey = markerName;
            markersXml += `
    <marker>
      <name>${escapeXml(markerName)}</name>
      <comment>Folder: ${escapeXml(markerName)}</comment>
      <in>${startFrame}</in>
      <out>${startFrame}</out>
      <color>Cyan</color>
    </marker>`;
          }

          // Full <file> definition on V1 (omit synthetic timecode so Premiere Pro binds natively to camera embedded timecode)
          const fileXml = `
          <file id="${fileId}">
            <name>${escapeXml(clip.name)}</name>
            <pathurl>${escapeXml(pathUrlStr)}</pathurl>
            <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
            <duration>${clipFramesOnTimeline}</duration>
            <media>
              <video>
                <samplecharacteristics>
                  <width>${info.width || seqWidth}</width>
                  <height>${info.height || seqHeight}</height>
                  <pixelaspectratio>square</pixelaspectratio>
                </samplecharacteristics>
              </video>
              <audio>
                <channelcount>${info.audioChannels || 2}</channelcount>
                <samplecharacteristics>
                  <depth>16</depth>
                  <samplerate>48000</samplerate>
                </samplecharacteristics>
              </audio>
            </media>
          </file>`;

          const hasAudioTrack = (info.audioChannels || 2) > 0;
          if (hasAudioTrack) {
            audioTrackClipCount++;
          }

          const vClipIndex = idx + 1;
          const aClipIndex = audioTrackClipCount;

          const linkXml = hasAudioTrack ? `
          <link>
            <linkclipref>${vClipId}</linkclipref>
            <mediatype>video</mediatype>
            <trackindex>1</trackindex>
            <clipindex>${vClipIndex}</clipindex>
          </link>
          <link>
            <linkclipref>${aClipId}</linkclipref>
            <mediatype>audio</mediatype>
            <trackindex>1</trackindex>
            <clipindex>${aClipIndex}</clipindex>
          </link>` : '';

          vClipsXml += `
        <clipitem id="${vClipId}">
          <masterclipid>${masterId}</masterclipid>
          <name>${escapeXml(clip.name)}</name>
          <enabled>TRUE</enabled>
          <duration>${clipFramesOnTimeline}</duration>
          <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>0</in>
          <out>${clipFramesOnTimeline}</out>
          ${fileXml}
          <sourcetrack>
            <mediatype>video</mediatype>
            <trackindex>1</trackindex>
          </sourcetrack>
          ${linkXml}
        </clipitem>`;

          if (hasAudioTrack) {
            aClipsXml += `
        <clipitem id="${aClipId}">
          <masterclipid>${masterId}</masterclipid>
          <name>${escapeXml(clip.name)}</name>
          <enabled>TRUE</enabled>
          <duration>${clipFramesOnTimeline}</duration>
          <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <in>0</in>
          <out>${clipFramesOnTimeline}</out>
          <file id="${fileId}"/>
          <sourcetrack>
            <mediatype>audio</mediatype>
            <trackindex>1</trackindex>
          </sourcetrack>
          ${linkXml}
        </clipitem>`;
          }

          currentFrame = endFrame;
        }

        const emptyVTrackXml = `
        <track>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>`;

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${escapeXml(projectName)}</name>
    <duration>${currentFrame}</duration>
    <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
    <timecode>
      <rate><timebase>${seqTb}</timebase><ntsc>${seqNtscStr}</ntsc></rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
${markersXml}
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${seqWidth}</width>
            <height>${seqHeight}</height>
            <pixelaspectratio>square</pixelaspectratio>
          </samplecharacteristics>
        </format>
        <track>
          ${vClipsXml}
        </track>
${emptyVTrackXml}
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <outputs>
          <group>
            <index>1</index>
            <numchannels>1</numchannels>
            <downmix>0</downmix>
            <channel><index>1</index></channel>
          </group>
          <group>
            <index>2</index>
            <numchannels>1</numchannels>
            <downmix>0</downmix>
            <channel><index>2</index></channel>
          </group>
        </outputs>
        <track>
          ${aClipsXml}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;

        const cleanProjectName = projectName.endsWith('.xml') || projectName.endsWith('.prproj')
          ? projectName.replace(/\.(xml|prproj)$/, '')
          : projectName;

        // Write Final Cut Pro XML file
        const xmlFilePath = path.join(folderPath, `${cleanProjectName}.xml`);
        fs.writeFileSync(xmlFilePath, xmlContent, 'utf8');

        // Write Native Adobe Premiere Pro Project (.prproj) binary
        const prprojFilePath = path.join(folderPath, `${cleanProjectName}.prproj`);
        const prprojBuffer = buildPrprojBuffer(cleanProjectName);
        fs.writeFileSync(prprojFilePath, prprojBuffer);

        // Optional Python automation if create_premiere_projects.py is present
        const pyScript = getOneTapPythonScript('create_premiere_projects.py');
        if (pyScript) {
          try {
            execFile('python', [pyScript, '--input', folderPath, '--output', prprojFilePath], { timeout: 15000 }, () => {});
          } catch {}
        }

        // Open if user requested
        if (openAfterCreate) {
          shell.openPath(prprojFilePath);
        }

        return {
          ok: true,
          xmlPath: xmlFilePath,
          prprojPath: prprojFilePath
        };
      } catch (err: any) {
        console.error('[afm:generatePremiereProject] Error:', err);
        return { ok: false, error: err.message || String(err) };
      }
    }
  );

  /**
   * 4. Inter-App Ecosystem Bridge: Send to Title Adder (Port 49152)
   */
  ipcMain.handle('afm:sendToTitleAdder', async (_event, folderPath: string): Promise<{ ok: boolean; error?: string }> => {
    return new Promise((resolve) => {
      try {
        const postData = JSON.stringify({ folderPath, timestamp: Date.now() });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: 49152,
            path: '/api/load-session',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 2000
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true });
            } else {
              resolve({ ok: false, error: `Title Adder returned status ${res.statusCode}` });
            }
          }
        );

        req.on('error', () => {
          // Fallback: Open Title Adder via deep link or shell open
          shell.openExternal(`onetap://title-adder?path=${encodeURIComponent(folderPath)}`).then(() => {
            resolve({ ok: true });
          }).catch(err => {
            resolve({ ok: false, error: 'Could not connect to Title Adder on port 49152. Is One Tap running?' });
          });
        });

        req.write(postData);
        req.end();
      } catch (err: any) {
        resolve({ ok: false, error: err.message || String(err) });
      }
    });
  });

  /**
   * One Tap Ecosystem Bridges (5 Core Services)
   */

  // 1. Task Tracker & Production Analytics Database
  ipcMain.handle('afm:getTaskTrackerStats', async (_event, dateSession: string, _safarName?: string) => {
    try {
      const db = getOneTapDb();
      if (!db) {
        return { ok: false, error: 'One Tap tracker database not found or offline.' };
      }

      const likeArg = `%${dateSession}%`;
      let tasks: any[] = [];
      try {
        const tasksQuery = db.prepare(
          `SELECT * FROM tracker_tasks WHERE (date_session = ? OR folder_name LIKE ?) ORDER BY updated_at DESC LIMIT 20`
        );
        tasks = tasksQuery.all(dateSession, likeArg) as any[];
      } catch {
        try {
          const fallbackQuery = db.prepare(
            `SELECT * FROM tracker_tasks WHERE (folder_name LIKE ?) ORDER BY rowid DESC LIMIT 20`
          );
          tasks = fallbackQuery.all(likeArg) as any[];
        } catch {
          tasks = [];
        }
      }

      let historyLogs: any[] = [];
      try {
        const histQuery = db.prepare(
          `SELECT * FROM tracker_history_logs WHERE (session_id = ? OR details LIKE ?) ORDER BY timestamp DESC LIMIT 25`
        );
        historyLogs = histQuery.all(dateSession, likeArg) as any[];
      } catch {}

      let totalRenderDuration = 0;
      let rendersCount = 0;
      tasks.forEach((t) => {
        if (t.render_duration_secs) totalRenderDuration += Number(t.render_duration_secs);
        if (t.stage === 'Rendered' || t.status === 'Completed' || t.status === 'Done') rendersCount++;
      });

      return {
        ok: true,
        stats: {
          sessionName: dateSession,
          stage: tasks.length > 0 ? tasks[0].stage || tasks[0].status : 'Pending',
          rendersCount,
          totalRenderDuration,
          lastUpdated: tasks.length > 0 ? tasks[0].updated_at : undefined,
          tasks,
          history: historyLogs
        }
      };
    } catch (err: any) {
      console.warn('[afm:getTaskTrackerStats] Error:', err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 2. DriveSync & Storage Backup Guard
  ipcMain.handle('afm:verifyBackupSync', async (_event, sourceDir: string, backupDir: string) => {
    try {
      if (!fs.existsSync(sourceDir)) return { ok: false, error: 'Source directory does not exist.' };
      if (!fs.existsSync(backupDir)) return { ok: false, error: 'Backup directory does not exist.' };

      const missingInBackup: string[] = [];
      const sizeMismatches: Array<{ file: string; sourceSize: number; backupSize: number }> = [];
      let totalFiles = 0;
      let syncedFiles = 0;

      function compareRecursive(relPath: string) {
        const srcFullPath = path.join(sourceDir, relPath);
        const bkpFullPath = path.join(backupDir, relPath);

        const items = fs.readdirSync(srcFullPath, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '$RECYCLE.BIN') continue;
          const itemRel = relPath ? path.join(relPath, item.name) : item.name;
          const sPath = path.join(srcFullPath, item.name);
          const bPath = path.join(bkpFullPath, item.name);

          if (item.isDirectory()) {
            if (fs.existsSync(bPath)) {
              compareRecursive(itemRel);
            } else {
              missingInBackup.push(itemRel + '\\');
            }
          } else if (item.isFile()) {
            totalFiles++;
            if (!fs.existsSync(bPath)) {
              missingInBackup.push(itemRel);
            } else {
              const srcStat = fs.statSync(sPath);
              const bkpStat = fs.statSync(bPath);
              if (srcStat.size !== bkpStat.size) {
                sizeMismatches.push({ file: itemRel, sourceSize: srcStat.size, backupSize: bkpStat.size });
              } else {
                syncedFiles++;
              }
            }
          }
        }
      }

      compareRecursive('');

      return {
        ok: true,
        totalFiles,
        syncedFiles,
        missingCount: missingInBackup.length,
        mismatchCount: sizeMismatches.length,
        missingInBackup: missingInBackup.slice(0, 50),
        sizeMismatches: sizeMismatches.slice(0, 50),
        isFullySynced: missingInBackup.length === 0 && sizeMismatches.length === 0
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 3. Photo / Video (PV) Separator
  ipcMain.handle('afm:separatePhotosAndVideos', async (_event, payload: { sourceDir: string; destDir?: string; mode?: 'copy' | 'move' }) => {
    try {
      const sourceDir = payload?.sourceDir;
      const destDir = payload?.destDir;
      const mode = payload?.mode || 'move';
      if (!sourceDir || !fs.existsSync(sourceDir)) return { ok: false, error: 'Source directory does not exist.' };
      const outTarget = destDir || sourceDir;
      const photosDir = path.join(outTarget, 'Photos');
      const videosDir = path.join(outTarget, 'Footage');

      const PHOTO_EXTS = new Set(['.cr2', '.cr3', '.nef', '.arw', '.dng', '.jpg', '.jpeg', '.png', '.heic', '.raw', '.raf', '.orf']);
      const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.m4v', '.mts', '.m2ts', '.braw']);

      if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

      const files = fs.readdirSync(sourceDir);
      let photosCount = 0;
      let videosCount = 0;

      for (const f of files) {
        const fullPath = path.join(sourceDir, f);
        if (!fs.statSync(fullPath).isFile()) continue;
        const ext = path.extname(f).toLowerCase();

        if (PHOTO_EXTS.has(ext)) {
          const destFile = path.join(photosDir, f);
          if (mode === 'move') {
            fs.renameSync(fullPath, destFile);
          } else {
            fs.copyFileSync(fullPath, destFile);
          }
          photosCount++;
        } else if (VIDEO_EXTS.has(ext) && destDir) {
          if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
          const destFile = path.join(videosDir, f);
          if (mode === 'move') {
            fs.renameSync(fullPath, destFile);
          } else {
            fs.copyFileSync(fullPath, destFile);
          }
          videosCount++;
        }
      }

      return {
        ok: true,
        photoCount: photosCount,
        videoCount: videosCount,
        movedCount: photosCount + videosCount,
        destDir: outTarget
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 4. Dynamic Island & Ambient Notification Feed
  ipcMain.handle('afm:dispatchAmbientEvent', async (_event, payload: { title: string; message: string; sound?: boolean }) => {
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: payload.title || 'Anything File Manager',
          body: payload.message || '',
          silent: payload.sound === false
        }).show();
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // 5. Disk Health & Storage Pill
  ipcMain.handle('afm:getDiskHealth', async (_event, drivePath?: string) => {
    try {
      const targetDrive = drivePath || (process.platform === 'win32' ? 'C:' : '/');
      const rootLetter = path.parse(path.resolve(targetDrive)).root;

      if (process.platform === 'win32') {
        const { execSync } = await import('child_process');
        const driveName = rootLetter.replace(/[:\\\/]/g, '');
        const output = execSync(
          `powershell -NoProfile -Command "Get-PSDrive -Name '${driveName}' | Select-Object Used, Free | ConvertTo-Json"`,
          { encoding: 'utf8', windowsHide: true }
        );
        const data = JSON.parse(output);
        const freeBytes = Number(data.Free || 0);
        const usedBytes = Number(data.Used || 0);
        const totalBytes = freeBytes + usedBytes;
        const freePercent = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 100;
        const isLowSpace = freePercent < 15 || freeBytes < 100 * 1024 * 1024 * 1024;

        return {
          ok: true,
          drive: rootLetter,
          freeBytes,
          usedBytes,
          totalBytes,
          freePercent: Math.round(freePercent * 10) / 10,
          isLowSpace,
          warningMessage: isLowSpace
            ? `Drive ${rootLetter} has low storage (${Math.round(freeBytes / (1024 * 1024 * 1024))} GB / ${Math.round(freePercent)}% free)`
            : undefined
        };
      }

      return { ok: true, drive: rootLetter, freePercent: 100, isLowSpace: false };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
