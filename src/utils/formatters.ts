/**
 * Formats raw byte count into human-readable size string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

/**
 * Formats epoch millisecond timestamp into localized date & time string.
 */
export function formatDate(mtime: number): string {
  if (!mtime) return '—';
  const d = new Date(mtime);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats duration in seconds into a clean timelapse or video badge.
 * E.g. 10 -> "10s", 45 -> "45s", 75 -> "1m 15s"
 */
export function formatTimelapse(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return '';
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

/**
 * Formats playback timestamp into MM:SS format.
 */
export function formatPlaybackTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
