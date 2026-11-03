import { protocol, net } from 'electron';
import fs from 'fs';
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
      let cleanUrl = request.url.replace(/^local-resource:\/\/?\/?/i, '');
      let rawPath = decodeURIComponent(cleanUrl);
      if (/^\/?[a-zA-Z]:[\\\/]/.test(rawPath)) {
        rawPath = rawPath.replace(/^\//, '');
      }
      rawPath = rawPath.replace(/\//g, '\\');

      if (!fs.existsSync(rawPath)) {
        return new Response('File not found', { status: 404 });
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
