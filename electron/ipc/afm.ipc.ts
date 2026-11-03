import { ipcMain, app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

const execAsync = promisify(exec);

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

    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
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
   * 2. Set Production Stage Tag
   */
  ipcMain.handle('afm:setStage', async (_event, folderPath: string, stage: ProductionStage): Promise<boolean> => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return false;
      const metaFile = path.join(folderPath, '.afm_meta.json');
      const existing = getOrInferMetadata(folderPath);
      const updated: AfmMetadata = {
        ...existing,
        stage,
        lastUpdated: Date.now()
      };
      fs.writeFileSync(metaFile, JSON.stringify(updated, null, 2), 'utf8');
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
          const durationFrames = Math.max(1, Math.round(clip.duration * timebase));
          const startFrame = trackOut;
          const endFrame = startFrame + durationFrames;
          trackOut = endFrame;

          const fileUrl = 'file://localhost/' + clip.fullPath.replace(/\\/g, '/');

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
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
