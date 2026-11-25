import { protocol } from 'electron';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

/**
 * Registers the privileged 'local-resource' scheme with streaming, standard, and fetch capabilities
 */
export function registerLocalResourceProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-resource',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        bypassCSP: true
      }
    }
  ]);
}

/**
 * Extracts a normalized, canonical Windows/OS filesystem path from a local-resource URL.
 * Accurately handles:
 * - local-resource:///C:/Users/...
 * - local-resource://C:/Users/...
 * - local-resource://localhost/C:/...
 * - URL percent-encoding (%20, %23, %3F, UTF-8 unicode)
 */
function extractLocalPath(requestUrl: string): string {
  let raw = requestUrl.replace(/^local-resource:\/\//i, '');
  raw = raw.replace(/^localhost[\/\\]/i, '');
  raw = raw.replace(/^\/+/, '');
  raw = decodeURIComponent(raw);
  raw = raw.replace(/\0/g, ''); // strip null bytes

  // Restore drive colon if lost by Chromium URL normalization (e.g. "c/Users/..." -> "c:/Users/...")
  if (/^[a-zA-Z][\\\/]/.test(raw)) {
    raw = raw[0] + ':' + raw.slice(1);
  } else if (/^\/?[a-zA-Z]:[\\\/]/.test(raw)) {
    raw = raw.replace(/^\//, '');
  }

  return path.normalize(raw.replace(/\//g, '\\'));
}

/**
 * Handles the 'local-resource' protocol with full HTTP 206 Partial Content Range streaming
 * required for HTML5 video playback, seeking, scrubbing, and audio streaming in Chromium.
 */
export function handleLocalResourceProtocol(): void {
  protocol.handle('local-resource', async (request) => {
    try {
      // 1. Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400'
          }
        });
      }

      // 2. Decode canonical file path
      const rawPath = extractLocalPath(request.url);

      // Security hardening: disallow access to system directory / sensitive files
      const sensitivePattern = /\\(windows|system32|system volume information|\.ssh|\.git|\.env|sam|security|software|system)\b/i;
      if (sensitivePattern.test(rawPath)) {
        return new Response('Access Denied', {
          status: 403,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 3. Allowed media/preview extensions check
      const ext = path.extname(rawPath).toLowerCase();
      const ALLOWED_EXTS = new Set([
        // Photos
        '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.ico', '.avif', '.tiff', '.tif', '.heic', '.heif',
        // RAW Photos
        '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.raw', '.orf', '.rw2', '.pef', '.sr2', '.srf',
        // Videos
        '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mts', '.mxf', '.mpg', '.mpeg', '.3gp', '.braw', '.vob', '.ogv', '.crm', '.r3d',
        // Audio
        '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.opus', '.aiff', '.aif', '.alac', '.mid', '.midi', '.wma',
        // Documents & Data
        '.pdf', '.docx', '.xlsx', '.csv', '.tsv', '.txt', '.md', '.json', '.xml',
        // Adobe Formats
        '.prproj', '.psd', '.psb', '.ai', '.aep'
      ]);

      if (!ALLOWED_EXTS.has(ext)) {
        return new Response('Forbidden resource type', {
          status: 403,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      const stat = fs.statSync(rawPath);
      if (!stat.isFile()) {
        return new Response('Target is not a file', {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 4. Accurate MIME map
      const MIME_MAP: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.m4v': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.ts': 'video/mp2t',
        '.mts': 'video/mp2t',
        '.m2ts': 'video/mp2t',
        '.mxf': 'video/mxf',
        '.mpg': 'video/mpeg',
        '.mpeg': 'video/mpeg',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.3gp': 'video/3gpp',
        '.ogv': 'video/ogg',
        '.vob': 'video/x-ms-vob',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/opus',
        '.aiff': 'audio/aiff',
        '.aif': 'audio/aiff',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.avif': 'image/avif',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        '.heic': 'image/heic',
        '.heif': 'image/heif',
        '.psd': 'image/vnd.adobe.photoshop',
        '.psb': 'image/vnd.adobe.photoshop',
        '.pdf': 'application/pdf',
        '.csv': 'text/csv; charset=utf-8',
        '.tsv': 'text/tab-separated-values; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.json': 'application/json'
      };
      const mimeType = MIME_MAP[ext] || 'application/octet-stream';

      // 5. Handle HTTP HEAD request (for video metadata probing)
      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': String(stat.size),
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }

      // 6. Handle HTTP 206 Partial Content (Range requests) — ESSENTIAL for video playback & seeking
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').trim().split('-');
        let start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        if (isNaN(start)) {
          start = Math.max(0, stat.size - (parseInt(parts[1], 10) || 0));
          end = stat.size - 1;
        }
        if (isNaN(end) || end >= stat.size) {
          end = stat.size - 1;
        }

        if (start > end || start >= stat.size) {
          return new Response(null, {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: {
              'Content-Range': `bytes */${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(rawPath, { start, end, highWaterMark: 256 * 1024 });

        // Terminate read stream on client abort
        if (request.signal) {
          request.signal.addEventListener('abort', () => stream.destroy());
        }

        const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

        return new Response(webStream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // 7. Full file stream (HTTP 200 OK with Accept-Ranges)
      const stream = fs.createReadStream(rawPath, { highWaterMark: 256 * 1024 });
      if (request.signal) {
        request.signal.addEventListener('abort', () => stream.destroy());
      }
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

      return new Response(webStream, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(stat.size),
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    } catch (err: any) {
      console.error('[local-resource] Error fetching:', err);
      return new Response('Error loading resource', {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  });
}
