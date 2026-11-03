import { VideoThumbnailData } from '../types';
import { mediaService } from './mediaService';

class ThumbnailService {
  private cache = new Map<string, VideoThumbnailData>();
  private pending = new Map<string, Promise<VideoThumbnailData | null>>();
  private queue: (() => void)[] = [];
  private activeWorkers = 0;
  private maxConcurrency = 8; // High-throughput parallel extraction

  getCached(filePath: string): VideoThumbnailData | undefined {
    return this.cache.get(filePath);
  }

  private runNext() {
    if (this.queue.length > 0 && this.activeWorkers < this.maxConcurrency) {
      this.activeWorkers++;
      const task = this.queue.shift();
      if (task) task();
    }
  }

  async extractVideoThumbnail(filePath: string): Promise<VideoThumbnailData | null> {
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    const inFlight = this.pending.get(filePath);
    if (inFlight) return inFlight;

    const promise = new Promise<VideoThumbnailData | null>(resolve => {
      const execute = async () => {
        try {
          // 1. Primary: Native Electron backend extraction with disk caching
          const res = await mediaService.getVideoMetadata(filePath);
          if (res && res.ok && (res.thumb || res.duration > 0)) {
            const data: VideoThumbnailData = {
              thumb: res.thumb || '',
              duration: res.duration || 0
            };
            this.cache.set(filePath, data);
            resolve(data);
            return;
          }
        } catch {}

        // 2. Fallback: Browser DOM HTML5 video tag
        try {
          const v = document.createElement('video');
          v.src = mediaService.toLocalResourceUrl(filePath);
          v.preload = 'metadata';
          v.muted = true;

          let timeoutId = setTimeout(() => {
            cleanup();
            resolve(null);
          }, 3000);

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
        } catch {
          resolve(null);
        }
      };

      this.queue.push(async () => {
        try {
          await execute();
        } finally {
          this.activeWorkers--;
          this.runNext();
        }
      });
      this.runNext();
    }).finally(() => {
      this.pending.delete(filePath);
    });

    this.pending.set(filePath, promise);
    return promise;
  }
}

export const thumbnailService = new ThumbnailService();
