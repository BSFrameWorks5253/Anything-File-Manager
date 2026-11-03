import { VideoThumbnailData } from '../types';
import { mediaService } from './mediaService';

class ThumbnailService {
  private cache = new Map<string, VideoThumbnailData>();
  private pending = new Map<string, Promise<VideoThumbnailData | null>>();

  getCached(filePath: string): VideoThumbnailData | undefined {
    return this.cache.get(filePath);
  }

  async extractVideoThumbnail(filePath: string): Promise<VideoThumbnailData | null> {
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    // Deduplicate in-flight requests for the same file
    const inFlight = this.pending.get(filePath);
    if (inFlight) return inFlight;

    const promise = (async () => {
      // 1. Primary: Native Electron backend extraction (ffmpeg/ffprobe & Windows Shell COM)
      try {
        const res = await mediaService.getVideoMetadata(filePath);
        if (res && res.ok && (res.thumb || res.duration > 0)) {
          const data: VideoThumbnailData = {
            thumb: res.thumb || '',
            duration: res.duration || 0
          };
          this.cache.set(filePath, data);
          return data;
        }
      } catch (err) {
        console.warn('[ThumbnailService] Native extraction error, falling back to DOM video:', err);
      }

      // 2. Fallback: Browser DOM HTML5 video tag
      return new Promise<VideoThumbnailData | null>(resolve => {
        const v = document.createElement('video');
        v.src = mediaService.toLocalResourceUrl(filePath);
        v.preload = 'metadata';
        v.muted = true;

        let timeoutId = setTimeout(() => {
          cleanup();
          resolve(null);
        }, 4000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          v.onloadedmetadata = null;
          v.onseeked = null;
          v.onerror = null;
          v.src = '';
        };

        v.onloadedmetadata = () => {
          const dur = v.duration || 0;
          const targetTime = Math.min(Math.max(0.5, dur * 0.1), dur > 1 ? dur - 0.2 : 0);
          v.currentTime = targetTime;
        };

        v.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const w = v.videoWidth || 320;
            const h = v.videoHeight || 180;
            canvas.width = Math.min(320, w);
            canvas.height = Math.round((canvas.width / w) * h);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const result: VideoThumbnailData = {
                thumb: dataUrl,
                duration: v.duration || 0
              };
              this.cache.set(filePath, result);
              cleanup();
              resolve(result);
              return;
            }
          } catch {}
          cleanup();
          resolve(null);
        };

        v.onerror = () => {
          cleanup();
          resolve(null);
        };
      });
    })().finally(() => {
      this.pending.delete(filePath);
    });

    this.pending.set(filePath, promise);
    return promise;
  }
}

export const thumbnailService = new ThumbnailService();
