import { protocol, net } from 'electron';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Readable } from 'stream';

/**
 * Registers and handles the privileged 'local-resource' protocol for high-performance
 * media streaming (including 206 Partial Content for video seeking and Range requests)
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
        corsEnabled: true
      }
    }
  ]);
}

export function handleLocalResourceProtocol(): void {
  protocol.handle('local-resource', (request) => {
    try {
      let s = request.url.replace(/^local-resource:\/\//i, '');
      s = s.replace(/^\/+/, '');
      s = s.replace(/^localhost[\/\\]/i, '');
      s = decodeURIComponent(s);

      // Security hardening: strip null bytes to prevent null byte poison injection
      s = s.replace(/\0/g, '');

      // Restore drive colon if lost by Chromium URL normalization (e.g. "c/Users/..." -> "c:/Users/...")
      if (/^[a-zA-Z][\\\/]/.test(s)) {
        s = s[0] + ':' + s.slice(1);
      } else if (/^\/?[a-zA-Z]:[\\\/]/.test(s)) {
        s = s.replace(/^\//, '');
      }

      // Normalize path to canonical OS separator and resolve fully
      const rawPath = path.resolve(path.normalize(s.replace(/\//g, '\\')));

      // Security hardening: disallow access to system directory / sensitive files
      const sensitivePattern = /\\(windows|system32|system volume information|\.ssh|\.git|\.env|sam|security|software|system)\b/i;
      if (sensitivePattern.test(rawPath)) {
        return new Response('Access Denied', { status: 403 });
      }

      // Allowed media/preview extensions check
      const ext = path.extname(rawPath).toLowerCase();
      const ALLOWED_EXTS = new Set([
        '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.ico', '.avif', '.tiff', '.tif', '.heic', '.heif',
        '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.raw', '.orf', '.rw2',
        '.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mts', '.mxf', '.mpg', '.mpeg', '.3gp', '.braw',
        '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.aiff', '.aif',
        '.pdf', '.docx', '.xlsx', '.csv', '.tsv', '.txt', '.md', '.json', '.prproj', '.xml'
      ]);
      if (!ALLOWED_EXTS.has(ext)) {
        return new Response('Forbidden resource type', { status: 403 });
      }

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 });
      }

      // Security check: ensure target is an actual file, not a directory or device
      const stat = fs.statSync(rawPath);
      if (!stat.isFile()) {
        return new Response('Target is not a file', { status: 400 });
      }

      // MIME types dictionary for accurate streaming and playback
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
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
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
        '.pdf': 'application/pdf',
        '.csv': 'text/csv; charset=utf-8',
        '.tsv': 'text/tab-separated-values; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.json': 'application/json'
      };
      const mimeType = MIME_MAP[ext] || 'application/octet-stream';

      // ── Handle HTTP 206 Partial Content & Range requests for smooth video scrubbing ──
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        let start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        if (isNaN(start)) start = 0;
        if (isNaN(end) || end >= stat.size) end = stat.size - 1;

        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(rawPath, { start, end, highWaterMark: 128 * 1024 });

        // Cleanly terminate file stream on request abort
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
            'Cache-Control': 'no-cache'
          }
        });
      }

      // Stream entire file with Accept-Ranges enabled
      const stream = fs.createReadStream(rawPath, { highWaterMark: 128 * 1024 });
      if (request.signal) {
        request.signal.addEventListener('abort', () => stream.destroy());
      }
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

      return new Response(webStream, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(stat.size),
          'Content-Type': mimeType
        }
      });
    } catch (err: any) {
      console.error('[local-resource] Error fetching:', err);
      return new Response('Error loading resource', { status: 500 });
    }
  });
}
