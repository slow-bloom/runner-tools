/**
 * Format total seconds into a readable clock string (e.g. "3:45", "1:24:30")
 * @param totalSecs Total duration in seconds
 */
export function formatTime(totalSecs: number): string {
  if (!Number.isFinite(totalSecs) || totalSecs < 0) return '—';
  const roundedSecs = Math.round(totalSecs);
  const h = Math.floor(roundedSecs / 3600);
  const m = Math.floor((roundedSecs % 3600) / 60);
  const s = roundedSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format pace seconds into standard running pace string (e.g. 4'30")
 * @param secsPerUnit Seconds per km or per mile
 */
export function formatPace(secsPerUnit: number): string {
  if (!Number.isFinite(secsPerUnit) || secsPerUnit <= 0) return '—';
  const roundedSecs = Math.round(secsPerUnit);
  const m = Math.floor(roundedSecs / 60);
  const s = roundedSecs % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}
