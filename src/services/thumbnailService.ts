import { VideoThumbnailData } from '../types';
import { mediaService } from './mediaService';

class ThumbnailService {
  private cache = new Map<string, VideoThumbnailData>();
  private pending = new Map<string, Promise<VideoThumbnailData | null>>();
  private queue: (() => void)[] = [];
  private activeWorkers = 0;
  private maxConcurrency = 2; // Smooth UI without thread starvation

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

        // In Electron, if native extraction produces nothing, resolve cleanly to avoid Chromium thread freezing
        resolve(null);
      };

      this.queue.push(() => {
        execute().finally(() => {
          this.activeWorkers--;
          this.pending.delete(filePath);
          this.runNext();
        });
      });

      this.runNext();
    });

    this.pending.set(filePath, promise);
    return promise;
  }
}

export const thumbnailService = new ThumbnailService();
