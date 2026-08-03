/** Shared formatting helpers. */

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
  ));
}

export function formatDuration(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const seconds = Math.floor(safe / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
  return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
}

/** 14445 -> 14.4k. Token counts run to millions, so the cell has to stay short. */
export function formatCount(value) {
  if (!Number.isFinite(value)) return '-';
  if (value < 1000) return String(value);
  if (value < 1000000) return (value / 1000).toFixed(value < 10000 ? 1 : 0) + 'k';
  return (value / 1000000).toFixed(1) + 'M';
}

/** 2026-08-03T17:10:32Z -> 17:10, in the reader's own timezone. */
export function formatClock(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}
