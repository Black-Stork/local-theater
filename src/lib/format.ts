export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number) {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(downloaded: number, total: number, speed: number) {
  if (!total || downloaded >= total) return "—";
  if (!speed || speed < 2048) return "stalled";
  const seconds = Math.round((total - downloaded) / speed);
  if (seconds > 86400 * 7) return "stalled";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatPercent(progress: number) {
  return `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%`;
}
