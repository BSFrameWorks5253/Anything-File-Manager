import { VideoThumbnailData } from '../types';
import { mediaService } from './mediaService';

class ThumbnailService {
  private cache = new Map<string, VideoThumbnailData>();

  getCached(filePath: string): VideoThumbnailData | undefined {
    return this.cache.get(filePath);
  }

  async extractVideoThumbnail(filePath: string): Promise<VideoThumbnailData | null> {
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    return new Promise(resolve => {
      const v = document.createElement('video');
      v.src = mediaService.toLocalResourceUrl(filePath);
      v.crossOrigin = 'anonymous';
      v.preload = 'metadata';
      v.muted = true;

      let timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeoutId);
        v.onloadedmetadata = null;
        v.onseeked = null;
        v.onerror = null;
        v.src = '';
      };

      v.onloadedmetadata = () => {
        const dur = v.duration || 0;
        // Seek to 1s or 10%
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
        } catch {
          // non-fatal
        }
        cleanup();
        resolve(null);
      };

      v.onerror = () => {
        cleanup();
        resolve(null);
      };
    });
  }
}

export const thumbnailService = new ThumbnailService();
