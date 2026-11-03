export const PHOTO_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif',
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw'
]);

export const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts', 'wmv', 'flv', 'm2ts', 'mpg', 'mpeg'
]);

export function isPhotoExtension(ext: string): boolean {
  return PHOTO_EXTENSIONS.has(ext.toLowerCase());
}

export function isVideoExtension(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

export function isMediaExtension(ext: string): boolean {
  const lower = ext.toLowerCase();
  return PHOTO_EXTENSIONS.has(lower) || VIDEO_EXTENSIONS.has(lower);
}
