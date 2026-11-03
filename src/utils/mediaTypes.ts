export const RAW_EXTENSIONS = new Set([
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'raw', 'orf', 'rw2', 'pef', 'sr2', 'srf'
]);

export const STANDARD_PHOTO_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif', 'heic', 'heif'
]);

export const PHOTO_EXTENSIONS = new Set([
  ...STANDARD_PHOTO_EXTENSIONS,
  ...RAW_EXTENSIONS
]);

export const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'm2ts', 'mts', 'mpg', 'mpeg', '3gp', 'vob', 'ogv'
]);

export const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff', 'alac', 'mid', 'midi'
]);

export const DOC_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'md', 'csv', 'odt', 'ods', 'odp'
]);

export const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab'
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

export function isAudioExtension(ext: string): boolean {
  return AUDIO_EXTENSIONS.has(ext.toLowerCase());
}

export function isDocExtension(ext: string): boolean {
  return DOC_EXTENSIONS.has(ext.toLowerCase());
}

export function isMediaExtension(ext: string): boolean {
  const lower = ext.toLowerCase();
  return PHOTO_EXTENSIONS.has(lower) || VIDEO_EXTENSIONS.has(lower) || AUDIO_EXTENSIONS.has(lower);
}
