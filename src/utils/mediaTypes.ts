export const RAW_EXTENSIONS = new Set([
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'pef', 'sr2', 'srf'
]);

export const STANDARD_PHOTO_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif'
]);

export const PHOTO_EXTENSIONS = new Set([
  ...STANDARD_PHOTO_EXTENSIONS,
  ...RAW_EXTENSIONS
]);

export const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'ts', 'wmv', 'flv', 'm2ts', 'mpg', 'mpeg', '3gp'
]);

export function isRawExtension(ext: string): boolean {
  return RAW_EXTENSIONS.has(ext.toLowerCase());
}

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
