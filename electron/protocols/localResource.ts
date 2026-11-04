import { protocol, net } from 'electron';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

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

      // Normalize path to canonical OS separator
      const rawPath = path.normalize(s.replace(/\//g, '\\'));

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 });
      }

      // Security check: ensure target is an actual file, not a directory or device
      const stat = fs.statSync(rawPath);
      if (!stat.isFile()) {
        return new Response('Target is not a file', { status: 400 });
      }

      // Delegate directly to Chromium's native file URL reader via net.fetch.
      // This handles Range headers (HTTP 206 Partial Content), video seeking,
      // moov atom parsing, and MIME types natively with maximum performance.
      const fileUrl = pathToFileURL(rawPath).toString();
      return net.fetch(fileUrl);
    } catch (err: any) {
      console.error('[local-resource] Error fetching:', err);
      return new Response('Error loading resource', { status: 500 });
    }
  });
}
