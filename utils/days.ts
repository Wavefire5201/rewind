/**
 * Local calendar days as YYYY-MM-DD strings: stepping, ranges, and keeping a day inside one.
 * Pure — no React.
 */

/** The local day `days` away. Worked at noon, so a clock change can't skip or repeat a day. */
export function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Every day from `start` through `end`, in order; empty when `start` is after `end`. */
export function dayRange(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = shiftDay(d, 1)) days.push(d);
  return days;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `date` kept within [start, end]; `end` when there's no usable date. */
export function clampDay(date: string | undefined, start: string, end: string): string {
  if (!date || !DAY.test(date)) return end;
  if (date < start) return start;
  if (date > end) return end;
  return date;
}
