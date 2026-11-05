import { ipcMain, app, shell, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import zlib from 'zlib';
import { readFastMp4Duration, getCachedVideoDuration, setCachedVideoDuration } from './media.ipc';

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
  'mp4', 'mov', 'avi', 'mkv', 'mts', 'm2ts', 'mxf', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp',
  'braw', 'crm', 'r3d', 'ari', 'arx', 'cine', 'ts', 'tp', 'm2t', 'mod', 'tod', 'divx', 'dv', 'dif',
  'hevc', 'h264', 'h265', '264', '265', 'f4v', 'asf', 'mp4v', 'insv', 'lrf', 'lrv', 'dat',
  'm2v', 'm4p', 'nev', 'qt', 'rm', 'rmvb', 'vro', 'wtv', 'dvr-ms', 'ogm', 'mpe', 'mpv', 'm2p', '3g2', 'avchd'
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
const MASTER_SAFAR_REGEX = /^(\d{4})[-_](\d{2})(?:[-_](\d{2}))?[\s\-_]+([A-Za-z\s]+)(?:-(.*))?$/;
const DATE_SESSION_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2})\s*_?(\d{2})([ME])$/i;
const SLOT_FORMAT_A_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{1,3}[a-zA-Z]?)-(?:(\d{1,3})?([A-Z]+))-(\d{5,8})$/i;
const SLOT_FORMAT_B_REGEX = /^(\d{4}[-_]\d{2}[-_]\d{2}\s*_?\d{2}[ME])-(\d{1,3}[a-zA-Z]?)-([A-Z]+)-?$/i;
const SLOT_FORMAT_B_MASTER_PREFIX_REGEX = /^(\d{4}[-_]\d{2}(?:[-_]\d{2})?[\s\-_]+[A-Za-z\s]+)-(\d{1,3}[a-zA-Z]?)-([A-Za-z]+)-?$/i;
const SHORT_SLOT_A_REGEX = /^(\d{1,3}[a-zA-Z]?)-(?:(\d{1,3})?([A-Z]+))-(\d{5,8})$/i;
const SHORT_SLOT_B_REGEX = /^(\d{1,3}[a-zA-Z]?)-(?:(\d{1,3})?([A-Z]+))-?$/i;
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

    // 1. Check persistent disk cache
    const diskCached = getCachedVideoDuration(cacheKey);
    if (diskCached !== undefined && diskCached > 0) {
      durationCache.set(cacheKey, diskCached);
      return diskCached;
    }

    // 2. Instant container atom parsing for MP4/MOV/M4V/QT (0.1ms)
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    if (['mp4', 'mov', 'm4v', 'qt'].includes(ext)) {
      const fastDur = readFastMp4Duration(filePath);
      if (fastDur && fastDur > 0) {
        durationCache.set(cacheKey, fastDur);
        setCachedVideoDuration(cacheKey, fastDur);
        return fastDur;
      }
    }

    // 3. Fallback: ffprobe with multi-stream detection for MTS, M2TS, MXF, TS
    const ffprobeBin = findFfprobeBinary();
    const { stdout } = await execFileAsync(
      ffprobeBin,
      ['-v', 'error', '-show_entries', 'stream=duration,nb_frames,r_frame_rate:format=duration', '-of', 'json', filePath],
      { timeout: 1500 }
    );
    try {
      const json = JSON.parse(stdout);
      let dur = parseFloat(json?.format?.duration || '0');
      if (!isFinite(dur) || dur <= 0) {
        const vStream = json?.streams?.find((s: any) => s.duration || s.nb_frames);
        if (vStream) {
          dur = parseFloat(vStream.duration || '0');
          if ((!isFinite(dur) || dur <= 0) && vStream.nb_frames && vStream.r_frame_rate) {
            const parts = vStream.r_frame_rate.split('/');
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1] || '1');
            if (num > 0 && den > 0) {
              dur = Number(vStream.nb_frames) / (num / den);
            }
          }
        }
      }
      if (isFinite(dur) && dur > 0) {
        const rounded = Math.round(dur * 10) / 10;
        durationCache.set(cacheKey, rounded);
        setCachedVideoDuration(cacheKey, rounded);
        return rounded;
      }
    } catch {}
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


function findTemplatePrprojPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'build', 'templates', 'premiere_clean_template.prproj'),
    path.join(app.getAppPath(), 'build', 'templates', 'premiere_clean_template.prproj'),
    path.join(path.dirname(app.getAppPath()), 'build', 'templates', 'premiere_clean_template.prproj'),
    path.join(__dirname, '..', '..', 'build', 'templates', 'premiere_clean_template.prproj'),
    path.join(__dirname, '..', 'build', 'templates', 'premiere_clean_template.prproj'),
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything Apps\\One Tap\\resources\\templates\\template.prproj',
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything\\Anything Apps\\Media Viewer\\build\\templates\\premiere_clean_template.prproj'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

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
  const templatePath = findTemplatePrprojPath();
  if (templatePath) {
    try {
      const templateBuf = fs.readFileSync(templatePath);
      let xml = '';
      if (templateBuf.length > 2 && templateBuf[0] === 0x1f && templateBuf[1] === 0x8b) {
        xml = zlib.gunzipSync(templateBuf).toString('utf8');
      } else {
        xml = templateBuf.toString('utf8');
      }
      if (xml.includes('<ProjectName>')) {
        xml = xml.replace(/<ProjectName>[\s\S]*?<\/ProjectName>/g, `<ProjectName>${escapeXml(folderName)}</ProjectName>`);
      }
      if (xml.includes('Template Sequence')) {
        xml = xml.replace(/Template Sequence/g, `${escapeXml(folderName)} Sequence`);
      }
      return zlib.gzipSync(Buffer.from(xml, 'utf8'));
    } catch (e) {
      console.warn('[buildPrprojBuffer] Error adapting template, returning verbatim:', e);
      return fs.readFileSync(templatePath);
    }
  }
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
		</Items>
	</RootProjectGroup>
	<Sequence id="3" ClassID="18d84411-9a74-4b53-b39f-16a75f10b50e" Version="7">
		<Node Version="1">
			<Properties Version="1">
				<Name>${escapeXml(folderName)} Sequence</Name>
			</Properties>
		</Node>
		<Media ObjectRef="4"/>
	</Sequence>
	<Media id="4" ClassID="587dfa4e-d007-4ef8-a400-bdfeb00d8bc3" Version="27">
		<VideoTrackGroup ObjectRef="5"/>
		<AudioTrackGroup ObjectRef="6"/>
	</Media>
	<VideoTrackGroup id="5" ClassID="0ba20fe6-5ef1-4043-9828-ea0808bfa0d2" Version="4">
		<Tracks Version="1">
			<Track Index="0" ObjectRef="7"/>
		</Tracks>
	</VideoTrackGroup>
	<VideoTrack id="7" ClassID="a437ae5d-ad4c-41b2-bf89-53fcb749d05e" Version="4">
		<ClipItems Version="1"/>
	</VideoTrack>
	<AudioTrackGroup id="6" ClassID="47e7d9eb-fffa-42f5-93ae-c98f0e53a290" Version="4">
		<Tracks Version="1">
			<Track Index="0" ObjectRef="8"/>
		</Tracks>
	</AudioTrackGroup>
	<AudioTrack id="8" ClassID="1eb6ff82-bf72-4632-a50d-c014798695d6" Version="4">
		<ClipItems Version="1"/>
	</AudioTrack>
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
  /**
   * 1. Analyze Production Folder & Calculate Metrics (Blazing Fast & Robust)
   */
  ipcMain.handle('afm:analyzeFolder', async (_event, folderPath: string): Promise<AfmFolderAnalytics | null> => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return null;
      const folderName = path.basename(folderPath);

      // Determine classification
      let folderType: AfmFolderAnalytics['folderType'] = 'generic';
      const cleanName = folderName.trim();
      if (SLOT_FORMAT_A_REGEX.test(cleanName) || SHORT_SLOT_A_REGEX.test(cleanName)) {
        folderType = 'slot_item_a';
      } else if (
        SLOT_FORMAT_B_REGEX.test(cleanName) ||
        SLOT_FORMAT_B_MASTER_PREFIX_REGEX.test(cleanName) ||
        SHORT_SLOT_B_REGEX.test(cleanName)
      ) {
        folderType = 'slot_item_b';
      } else if (DATE_SESSION_REGEX.test(cleanName)) {
        folderType = 'date_session';
      } else if (CATEGORY_REGEX.test(cleanName)) {
        folderType = 'category';
      } else if (!cleanName.includes('_01M') && !cleanName.includes('_02E') && !cleanName.includes('_01E') && MASTER_SAFAR_REGEX.test(cleanName)) {
        folderType = 'master_safar';
      }

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
      const itsSeen = new Map<string, string[]>();
      const malformedItsList: string[] = [];

      // Collect video files for fast duration estimation & background probing
      const videoFilesToProbe: { path: string; size: number; cacheKey: string; slot?: any }[] = [];

      // Fast non-blocking recursive crawler (up to 12 levels deep for camera card structures)
      let itemCountSinceYield = 0;
      const crawlDirAsync = async (dir: string, depth: number, currentSlotInfo?: any) => {
        if (depth > 12) return;
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          for (const e of entries) {
            itemCountSinceYield++;
            if (itemCountSinceYield % 40 === 0) {
              await new Promise(r => setImmediate(r));
            }

            const fullP = path.join(dir, e.name);
            const lower = e.name.toLowerCase();

            if (e.isDirectory()) {
              if (SYSTEM_IGNORE_FOLDERS.has(lower) || lower === 'final' || lower === 'renders' || lower === 'dvd') continue;
              subfolderCount++;

              // Check if directory matches a slot or date session (only when scanning parent sessions)
              let slotContext = currentSlotInfo;
              if (folderType !== 'slot_item_a' && folderType !== 'slot_item_b') {
                const matchA = e.name.match(SLOT_FORMAT_A_REGEX) || e.name.match(SHORT_SLOT_A_REGEX);
                const matchB = e.name.match(SLOT_FORMAT_B_REGEX) || e.name.match(SLOT_FORMAT_B_MASTER_PREFIX_REGEX) || e.name.match(SHORT_SLOT_B_REGEX);
                const matchDate = e.name.match(DATE_SESSION_REGEX);

                if (matchA) {
                  const slotNo = matchA[2] || matchA[1];
                  const eventCode = (matchA[4] || matchA[3] || 'GEN').toUpperCase();
                  const its = matchA[5] || matchA[4];
                  const isValidIts = /^\d{5,8}$/.test(its);
                  if (!isValidIts) malformedItsList.push(its);
                  if (its) {
                    const prev = itsSeen.get(its) || [];
                    prev.push(e.name);
                    itsSeen.set(its, prev);
                  }
                  slotContext = {
                    slotFolder: e.name,
                    slotPath: fullP,
                    slotNo,
                    eventCode,
                    its,
                    isValidIts,
                    personName: '—',
                    clipCount: 0,
                    duration: 0,
                    size: 0
                  };
                  slots.push(slotContext);
                } else if (matchB) {
                  const slotNo = matchB[2] || matchB[1];
                  const eventCode = (matchB[3] || 'H').toUpperCase();
                  slotContext = {
                    slotFolder: e.name,
                    slotPath: fullP,
                    slotNo,
                    eventCode,
                    its: null,
                    isValidIts: true,
                    personName: '—',
                    clipCount: 0,
                    duration: 0,
                    size: 0
                  };
                  slots.push(slotContext);
                } else if (matchDate && folderType === 'master_safar') {
                  const dateMeta = getOrInferMetadata(fullP);
                  dates.push({
                    dateFolder: e.name,
                    datePath: fullP,
                    dateLabel: e.name,
                    itemCount: 0,
                    clipCount: 0,
                    duration: 0,
                    size: 0,
                    stage: dateMeta.stage,
                    prprojExists: false
                  });
                }
              }

              await crawlDirAsync(fullP, depth + 1, slotContext);
            } else {
              const ext = path.extname(e.name).toLowerCase().replace('.', '');
              if (ext === 'prproj') {
                hasPrproj = true;
                if (!prprojName) prprojName = e.name;
              }

              const isVid = VIDEO_EXTS.has(ext);
              const isPic = PHOTO_EXTS.has(ext);
              if (!isVid && !isPic && ext !== 'prproj') {
                continue;
              }

              try {
                const stat = await fs.promises.stat(fullP);
                totalStorageBytes += stat.size;

                if (currentSlotInfo) {
                  currentSlotInfo.size += stat.size;
                }

                if (isVid) {
                  videoClipCount++;
                  if (currentSlotInfo) currentSlotInfo.clipCount++;

                  const cacheKey = `${fullP}:${stat.size}:${stat.mtimeMs}`;
                  let dur = durationCache.get(cacheKey);

                  if (dur === undefined) {
                    // 1. Check persistent disk cache
                    dur = getCachedVideoDuration(cacheKey);
                  }

                  if (dur === undefined) {
                    // 2. Instant container atom parsing for MP4/MOV/QT/M4V (head + tail, 0.2ms)
                    if (['mp4', 'mov', 'm4v', 'qt'].includes(ext)) {
                      const fast = readFastMp4Duration(fullP);
                      if (fast && fast > 0) {
                        dur = fast;
                        setCachedVideoDuration(cacheKey, dur);
                      }
                    }
                  }

                  if (dur !== undefined && dur > 0) {
                    durationCache.set(cacheKey, dur);
                    cumulativeDurationSeconds += dur;
                    if (currentSlotInfo) currentSlotInfo.duration += dur;
                  } else {
                    videoFilesToProbe.push({ path: fullP, size: stat.size, cacheKey, slot: currentSlotInfo });
                  }
                } else if (isPic) {
                  stillPhotoCount++;
                }
              } catch {}
            }
          }
        } catch (dirErr) {
          console.warn('[afm:analyzeFolder] readdir warning for:', dir, dirErr);
        }
      };

      await crawlDirAsync(folderPath, 0);

      // Fast concurrent probing for uncached clips (concurrency: 8)
      if (videoFilesToProbe.length > 0) {
        await mapConcurrent(videoFilesToProbe, 8, async (item) => {
          try {
            const probed = await getFastVideoDuration(item.path);
            if (probed > 0) {
              durationCache.set(item.cacheKey, probed);
              setCachedVideoDuration(item.cacheKey, probed);
              cumulativeDurationSeconds += probed;
              if (item.slot) item.slot.duration += probed;
            }
          } catch {}
        });
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
  /**
   * Preflight subfolder discovery for One Tap Sequence Maker
   * Scans immediate subfolders to detect video clips, total sizes, and flags known output/render folders.
   */
  ipcMain.handle('afm:getSubfoldersPreflight', async (_event, folderPath: string) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { ok: false, error: 'Folder not found', subfolders: [] };
      }

      const knownOutputNames = new Set([
        'export', 'exports', 'render', 'renders', 'temp', 'scratch',
        'proxy', 'proxies', 'pxd', 'thumb', 'thumbs', 'thumbnail', 'thumbnails',
        'preview', 'previews', 'cache', 'dvd', 'output', 'web_exports'
      ]);

      interface SubfolderPreflightItem {
        name: string;
        relPath: string;
        fullPath: string;
        clipCount: number;
        photoCount: number;
        totalBytes: number;
        isOutputFolder: boolean;
        defaultExcluded: boolean;
      }

      const subfolders: SubfolderPreflightItem[] = [];
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      // First, scan direct video/photo files in folderPath itself!
      let rootClipCount = 0;
      let rootPhotoCount = 0;
      let rootTotalBytes = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          const fp = path.join(folderPath, entry.name);
          try {
            const st = fs.statSync(fp);
            rootTotalBytes += st.size;
            if (VIDEO_EXTS.has(ext)) rootClipCount++;
            else if (PHOTO_EXTS.has(ext)) rootPhotoCount++;
          } catch {}
        }
      }

      if (rootClipCount > 0 || rootPhotoCount > 0) {
        subfolders.push({
          name: '(Root / Direct Clips)',
          relPath: '.',
          fullPath: folderPath,
          clipCount: rootClipCount,
          photoCount: rootPhotoCount,
          totalBytes: rootTotalBytes,
          isOutputFolder: false,
          defaultExcluded: false
        });
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SYSTEM_IGNORE_FOLDERS.has(entry.name.toLowerCase())) continue;

        const subPath = path.join(folderPath, entry.name);
        let clipCount = 0;
        let photoCount = 0;
        let totalBytes = 0;

        const scanSub = (dir: string, curDepth = 0) => {
          if (curDepth > 12) return;
          try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const it of items) {
              const fp = path.join(dir, it.name);
              if (it.isDirectory()) {
                if (!SYSTEM_IGNORE_FOLDERS.has(it.name.toLowerCase())) {
                  scanSub(fp, curDepth + 1);
                }
              } else {
                const ext = path.extname(it.name).toLowerCase().replace('.', '');
                try {
                  const st = fs.statSync(fp);
                  totalBytes += st.size;
                  if (VIDEO_EXTS.has(ext)) clipCount++;
                  else if (PHOTO_EXTS.has(ext)) photoCount++;
                } catch {}
              }
            }
          } catch {}
        };

        scanSub(subPath, 0);

        const lowerName = entry.name.toLowerCase();
        const isOutputFolder = knownOutputNames.has(lowerName);

        subfolders.push({
          name: entry.name,
          relPath: entry.name,
          fullPath: subPath,
          clipCount,
          photoCount,
          totalBytes,
          isOutputFolder,
          defaultExcluded: isOutputFolder
        });
      }

      return {
        ok: true,
        folderPath,
        subfolders
      };
    } catch (err: any) {
      console.error('[afm:getSubfoldersPreflight] Error:', err);
      return { ok: false, error: err.message, subfolders: [] };
    }
  });

  /**
   * Launch One Tap application (only if explicitly clicked)
   */
  ipcMain.handle('afm:openOneTap', async (_event, targetPath?: string) => {
    try {
      const candidates = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'One Tap', 'One Tap.exe'),
        path.join(process.env.PROGRAMFILES || '', 'One Tap', 'One Tap.exe'),
        'C:\\Users\\Burhanuddin\\AppData\\Local\\Programs\\One Tap\\One Tap.exe'
      ];

      let exePath = null;
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          exePath = c;
          break;
        }
      }

      if (!exePath) {
        return { ok: false, error: 'One Tap executable not found at standard installation paths' };
      }

      const args = ['--page=prproj'];
      if (targetPath) {
        args.push(targetPath);
      }

      const { spawn } = require('child_process');
      const child = spawn(exePath, args, { detached: true, stdio: 'ignore' });
      child.unref();

      return { ok: true, path: exePath };
    } catch (err: any) {
      console.error('[afm:openOneTap] Error:', err);
      return { ok: false, error: err.message };
    }
  });

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/"/g, '""');
}

  async function generateSingleSequence(params: {
    folderPath: string;
    projectName: string;
    resolution: '1080p' | '4k';
    fps: number;
    openAfterCreate: boolean;
    excludedFolders?: string[];
    overwriteExisting?: boolean;
    generateManifest?: boolean;
  }): Promise<{ ok: boolean; prprojPath?: string; xmlPath?: string; manifestPath?: string; clipCount: number; error?: string }> {
    const { folderPath, projectName, resolution, fps, openAfterCreate, excludedFolders = [], overwriteExisting = true, generateManifest = true } = params;
    const excludedSet = new Set(excludedFolders.map((f: string) => f.toLowerCase().trim()));
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { ok: false, clipCount: 0, error: 'Target directory not found' };
    }

    const width = resolution === '4k' ? 3840 : 1920;
    const height = resolution === '4k' ? 2160 : 1080;
    const requestedFps = fps || 25;

    interface RawClipEntry {
      name: string;
      fullPath: string;
      subfolder: string;
      fileSize: number;
    }
    const rawClips: RawClipEntry[] = [];

    const scanClips = (dir: string, currentSubfolder: string, depth = 0) => {
      if (depth > 12) return;
      try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
          const p = path.join(dir, item.name);
          const lowerName = item.name.toLowerCase();
          const relPath = currentSubfolder ? `${currentSubfolder}/${item.name}`.toLowerCase() : lowerName;
          if (item.isDirectory() && !SYSTEM_IGNORE_FOLDERS.has(lowerName) && !excludedSet.has(lowerName) && !excludedSet.has(relPath)) {
            const sub = currentSubfolder ? `${currentSubfolder}/${item.name}` : item.name;
            scanClips(p, sub, depth + 1);
          } else if (!item.isDirectory()) {
            if (currentSubfolder === '' && (excludedSet.has('.') || excludedSet.has('(root / direct clips)'))) {
              continue;
            }
            const ext = path.extname(item.name).toLowerCase().replace('.', '');
            if (VIDEO_EXTS.has(ext)) {
              let statSize = 0;
              try { statSize = fs.statSync(p).size; } catch {}
              rawClips.push({
                name: item.name,
                fullPath: p,
                subfolder: currentSubfolder,
                fileSize: statSize
              });
            }
          }
        }
      } catch {}
    };

    scanClips(folderPath, '', 0);

    if (rawClips.length === 0) {
      return { ok: false, clipCount: 0, error: 'No supported video clips found in the selected folder.' };
    }

    rawClips.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const probedInfos = await mapConcurrent(rawClips, 8, async (clip) => {
      return await getVideoInfoNodeAsync(clip.fullPath);
    });

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
    const manifestRows: string[] = [
      'Sequence Name,File Name,Camera Angle / Subfolder,Duration (Sec),Timecode (HH:MM:SS),Width,Height,FPS,Audio Channels,Size (MB),Full Path'
    ];

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

      const durSec = Math.round(info.duration * 10) / 10;
      const hrs = Math.floor(durSec / 3600);
      const mins = Math.floor((durSec % 3600) / 60);
      const secs = Math.floor(durSec % 60);
      const pad = (n: number) => String(n).padStart(2, '0');
      const timecodeStr = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      const sizeMb = (clip.fileSize / (1024 * 1024)).toFixed(2);
      manifestRows.push(
        `"${escapeCsv(projectName)}","${escapeCsv(clip.name)}","${escapeCsv(clip.subfolder || 'Root')}","${durSec}","${timecodeStr}","${info.width}","${info.height}","${info.fps || seqTb}","${info.audioChannels}","${sizeMb}","${escapeCsv(clip.fullPath)}"`
      );

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

    const xmlFilePath = path.join(folderPath, `${cleanProjectName}.xml`);
    const prprojFilePath = path.join(folderPath, `${cleanProjectName}.prproj`);
    const manifestPath = path.join(folderPath, `${cleanProjectName}_Sequence_Manifest.csv`);

    fs.writeFileSync(xmlFilePath, xmlContent, 'utf8');

    const prprojBuffer = buildPrprojBuffer(cleanProjectName);
    fs.writeFileSync(prprojFilePath, prprojBuffer);

    if (generateManifest) {
      fs.writeFileSync(manifestPath, '\uFEFF' + manifestRows.join('\r\n'), 'utf8');
    }

    try {
      const osMod = require('os');
      const tmpTrk = path.join(osMod.tmpdir(), '.onetap_recent_xml.txt');
      const tmpTrk2 = path.join(osMod.tmpdir(), 'recent_xml.txt');
      const entry = `${cleanProjectName}=${xmlFilePath}`;
      let existing = '';
      if (fs.existsSync(tmpTrk)) {
        try { existing = fs.readFileSync(tmpTrk, 'utf-8'); } catch {}
      }
      const lines = existing.split(/\r?\n/).filter(l => l.trim() && !l.startsWith(entry) && l.trim() !== xmlFilePath);
      const newContent = [xmlFilePath, entry, ...lines].slice(0, 50).join('\n');
      fs.writeFileSync(tmpTrk, newContent, 'utf-8');
      fs.writeFileSync(tmpTrk2, newContent, 'utf-8');
      const userDir = app.getPath('userData');
      if (userDir) {
        fs.writeFileSync(path.join(userDir, 'recent_xml.txt'), newContent, 'utf-8');
      }
    } catch {}

    // Update One Tap tracker.db in background
    try {
      const db = getOneTapDb();
      if (db) {
        const dateFolder = path.basename(folderPath);
        const parentDir = path.dirname(folderPath);
        const safarName = path.basename(parentDir);
        const now = Date.now();
        const selectStmt = db.prepare('SELECT id FROM tracker_tasks WHERE date_folder = ? LIMIT 1');
        const row: any = selectStmt.get(dateFolder);
        if (row && row.id) {
          db.prepare('UPDATE tracker_tasks SET status = ?, prproj_path = ?, prproj_modified_at = ?, updated_at = ? WHERE id = ?')
            .run('editing', prprojFilePath, now, now, row.id);
        } else {
          db.prepare(
            'INSERT INTO tracker_tasks (safar_name, date_folder, status, working_path, prproj_path, prproj_modified_at, updated_at, first_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(safarName, dateFolder, 'editing', folderPath, prprojFilePath, now, now, now);
        }
      }
    } catch {}

    if (openAfterCreate) {
      if (fs.existsSync(prprojFilePath)) {
        shell.openPath(prprojFilePath);
      } else {
        shell.openPath(xmlFilePath);
      }
    }

    return {
      ok: true,
      xmlPath: xmlFilePath,
      prprojPath: prprojFilePath,
      manifestPath: generateManifest ? manifestPath : undefined,
      clipCount: rawClips.length
    };
  }

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
        excludedFolders?: string[];
        mode?: 'single' | 'master';
        overwriteExisting?: boolean;
        generateManifest?: boolean;
      }
    ): Promise<{ ok: boolean; prprojPath?: string; xmlPath?: string; manifestPath?: string; createdCount?: number; clipCount?: number; error?: string }> => {
      try {
        const { folderPath, projectName, resolution, fps, openAfterCreate, excludedFolders = [], mode = 'single', overwriteExisting = true, generateManifest = true } = payload;
        const excludedSet = new Set(excludedFolders.map((f: string) => f.toLowerCase().trim()));
        if (!folderPath || !fs.existsSync(folderPath)) {
          return { ok: false, error: 'Target directory not found' };
        }

        if (mode === 'master') {
          const entries = fs.readdirSync(folderPath, { withFileTypes: true });
          const createdProjects: string[] = [];
          let totalClipsAll = 0;
          for (const ent of entries) {
            if (!ent.isDirectory()) continue;
            const lower = ent.name.toLowerCase();
            if (SYSTEM_IGNORE_FOLDERS.has(lower) || lower === 'final' || lower === 'renders' || lower === 'dvd' || excludedSet.has(lower)) {
              continue;
            }
            const childPath = path.join(folderPath, ent.name);
            const res = await generateSingleSequence({
              folderPath: childPath,
              projectName: ent.name,
              resolution,
              fps,
              openAfterCreate: false,
              excludedFolders,
              overwriteExisting,
              generateManifest
            });
            if (res.ok && res.prprojPath) {
              createdProjects.push(res.prprojPath);
              totalClipsAll += res.clipCount;
            }
          }
          if (createdProjects.length === 0) {
            return { ok: false, error: 'No valid date session subfolders with clips found in master directory.' };
          }
          return {
            ok: true,
            createdCount: createdProjects.length,
            prprojPath: createdProjects[0],
            clipCount: totalClipsAll
          };
        } else {
          return await generateSingleSequence({
            folderPath,
            projectName,
            resolution,
            fps,
            openAfterCreate,
            excludedFolders,
            overwriteExisting,
            generateManifest
          });
        }
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
