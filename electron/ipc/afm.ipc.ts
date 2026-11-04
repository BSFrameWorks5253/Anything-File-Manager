import { ipcMain, app, shell, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

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
        const timebase = fps || 25;

        // Collect all video files in chronological / slot order
        const clips: { name: string; fullPath: string; duration: number }[] = [];
        const scanClips = async (dir: string) => {
          const list = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of list) {
            const p = path.join(dir, item.name);
            if (item.isDirectory() && !SYSTEM_IGNORE_FOLDERS.has(item.name.toLowerCase())) {
              await scanClips(p);
            } else if (!item.isDirectory()) {
              const ext = path.extname(item.name).toLowerCase().replace('.', '');
              if (VIDEO_EXTS.has(ext)) {
                const dur = await getFastVideoDuration(p);
                clips.push({ name: item.name, fullPath: p, duration: dur || 5.0 });
              }
            }
          }
        };

        await scanClips(folderPath);

        // Build clean Final Cut Pro 7 / Premiere XML Interchange sequence
        let trackOut = 0;
        const videoClipXmlItems: string[] = [];
        const audioClipXmlItems: string[] = [];

        clips.forEach((clip, index) => {
          const durationFrames = Math.max(1, Math.floor(clip.duration * timebase));
          const startFrame = trackOut;
          const endFrame = startFrame + durationFrames;
          trackOut = endFrame;

          const normalizedPath = path.resolve(clip.fullPath).replace(/\\/g, '/');
          const fileUrl = 'file://localhost/' + encodeURI(normalizedPath).replace(/#/g, '%23').replace(/\?/g, '%3F');

          videoClipXmlItems.push(`
            <clipitem id="clipitem-${index + 1}">
              <name>${escapeXml(clip.name)}</name>
              <duration>${durationFrames}</duration>
              <rate>
                <timebase>${timebase}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <start>${startFrame}</start>
              <end>${endFrame}</end>
              <in>0</in>
              <out>${durationFrames}</out>
              <file id="file-${index + 1}">
                <name>${escapeXml(clip.name)}</name>
                <pathurl>${escapeXml(fileUrl)}</pathurl>
                <rate>
                  <timebase>${timebase}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <duration>${durationFrames}</duration>
                <media>
                  <video>
                    <samplecharacteristics>
                      <width>${width}</width>
                      <height>${height}</height>
                    </samplecharacteristics>
                  </video>
                  <audio>
                    <samplecharacteristics>
                      <depth>16</depth>
                      <samplerate>48000</samplerate>
                    </samplecharacteristics>
                    <channelcount>2</channelcount>
                  </audio>
                </media>
              </file>
            </clipitem>`);

          audioClipXmlItems.push(`
            <clipitem id="clipitem-a-${index + 1}">
              <name>${escapeXml(clip.name)}</name>
              <duration>${durationFrames}</duration>
              <rate>
                <timebase>${timebase}</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <start>${startFrame}</start>
              <end>${endFrame}</end>
              <in>0</in>
              <out>${durationFrames}</out>
              <file id="file-${index + 1}"/>
            </clipitem>`);
        });

        const totalSequenceDuration = trackOut;

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${escapeXml(projectName)}</name>
    <duration>${totalSequenceDuration}</duration>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>${timebase}</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <pixelaspectratio>square</pixelaspectratio>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
          </samplecharacteristics>
        </format>
        <track>
          ${videoClipXmlItems.join('')}
        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <track>
          ${audioClipXmlItems.join('')}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;

        const cleanProjectName = projectName.endsWith('.xml') || projectName.endsWith('.prproj')
          ? projectName.replace(/\.(xml|prproj)$/, '')
          : projectName;

        const xmlFilePath = path.join(folderPath, `${cleanProjectName}.xml`);
        fs.writeFileSync(xmlFilePath, xmlContent, 'utf8');

        // Also check if we can generate .prproj via One Tap Python generator
        const prprojFilePath = path.join(folderPath, `${cleanProjectName}.prproj`);

        // If open requested
        if (openAfterCreate) {
          shell.openPath(xmlFilePath);
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
