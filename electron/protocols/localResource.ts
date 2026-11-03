import { protocol } from 'electron';
import fs from 'fs';
import path from 'path';

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
        bypassCSP: true,
        stream: true,
        corsEnabled: true
      }
    }
  ]);
}

export function handleLocalResourceProtocol(): void {
  protocol.handle('local-resource', async (request) => {
    try {
      let cleanUrl = request.url.replace(/^local-resource:\/\/?\/?/i, '');
      let rawPath = decodeURIComponent(cleanUrl);
      if (/^\/?[a-zA-Z]:[\\\/]/.test(rawPath)) {
        rawPath = rawPath.replace(/^\//, '');
      }
      rawPath = rawPath.replace(/\//g, '\\');

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 });
      }

      const ext = path.extname(rawPath).toLowerCase();
      const MIME: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
        '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
        '.ts': 'video/mp2t', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv'
      };
      const contentType = MIME[ext] || 'application/octet-stream';

      const fileStat = fs.statSync(rawPath);
      const fileSize = fileStat.size;

      // Range header support for video seeking
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024 * 2, fileSize - 1);
          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(rawPath, { start, end });
          const webStream = new ReadableStream({
            start(controller) {
              stream.on('data', chunk => controller.enqueue(chunk));
              stream.on('end', () => controller.close());
              stream.on('error', e => controller.error(e));
            },
            cancel() { stream.destroy(); }
          });
          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      const buf = fs.readFileSync(rawPath);
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buf.length),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch {
      return new Response('Error loading resource', { status: 500 });
    }
  });
}
