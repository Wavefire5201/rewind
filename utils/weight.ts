/**
 * Weights: units, input, the album card's readout, and its chart. Pure — no React, no native modules.
 *
 * Entries keep the value and unit they were entered in; everything here converts on the way out,
 * so switching units never rewrites history.
 */
import type { AppSettings, WeightEntry, WeightUnit, WeightValue } from '@/types';
import { dayIndex } from '@/utils/dates';
import type { DayDomain } from '@/utils/faceTrend';

export const KG_PER_LB = 0.45359237;
/** The weights a person can plausibly enter: 9–227 kg (20–500 lb). */
export const MIN_KG = 9;
export const MAX_KG = 227;
/** Entries further apart than this aren't joined by the chart's line. */
export const MAX_LINE_GAP_DAYS = 7;
export const DELTA_DAYS = [7, 30, 90] as const;

export const unitFor = (units: AppSettings['units']): WeightUnit => (units === 'imperial' ? 'lb' : 'kg');

export function toKg(w: WeightValue): number {
  return w.unit === 'kg' ? w.value : w.value * KG_PER_LB;
}

/** A weight in `unit`. */
export function inUnit(w: WeightValue, unit: WeightUnit): number {
  if (w.unit === unit) return w.value;
  return unit === 'kg' ? w.value * KG_PER_LB : w.value / KG_PER_LB;
}

const kgIn = (kg: number, unit: WeightUnit) => (unit === 'kg' ? kg : kg / KG_PER_LB);

/** "172.4 lb". */
export function formatWeight(w: WeightValue, unit: WeightUnit): string {
  return `${inUnit(w, unit).toFixed(1)} ${unit}`;
}

/** The value for an input field in `unit`: "172.4", or "172" for a whole number. */
export function weightInputText(w: WeightValue, unit: WeightUnit): string {
  const v = Math.round(inUnit(w, unit) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function isValidWeight(w: WeightValue): boolean {
  if (!Number.isFinite(w.value) || (w.unit !== 'lb' && w.unit !== 'kg')) return false;
  const kg = toKg(w);
  return kg >= MIN_KG && kg <= MAX_KG;
}

/** The range accepted in `unit`, for an error message: "20–500 lb". */
export function validRangeText(unit: WeightUnit): string {
  return unit === 'kg' ? `${MIN_KG}–${MAX_KG} kg` : `${Math.ceil(MIN_KG / KG_PER_LB)}–${Math.floor(MAX_KG / KG_PER_LB)} lb`;
}

/**
 * Typed input as a weight in `unit`, or null when it isn't one (empty, not a number, or out of
 * range). A comma works as the decimal separator; the value is rounded to one decimal place.
 */
export function parseWeightInput(text: string, unit: WeightUnit): WeightValue | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return null;
  const w = { value: Math.round(Number(t) * 10) / 10, unit };
  return isValidWeight(w) ? w : null;
}

export const weightKey = (w: Pick<WeightEntry, 'albumId' | 'date'>) => `${w.albumId}:${w.date}`;

/**
 * Change over the last `days`: the latest entry against the last one on or before that many days
 * earlier. That entry has to be near the target (within a third of the window), so after a long
 * gap in the log a "7d" change can't quietly compare against months ago.
 */
export interface WeightDelta {
  days: number;
  /** In the display unit. */
  change: number;
}

export interface WeightReadout {
  latest: WeightEntry;
  deltas: WeightDelta[];
  /** How far the latest weight is from the goal, in the display unit; 0 once it's reached. */
  toGoal: number | null;
}

/** The card's numbers for one album's entries (sorted by date). Null without entries. */
export function weightReadout(entries: readonly WeightEntry[], unit: WeightUnit, goal?: WeightValue): WeightReadout | null {
  if (entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  const latestDay = dayIndex(latest.date);
  const latestKg = toKg(latest);
  const deltas: WeightDelta[] = [];
  for (const days of DELTA_DAYS) {
    const target = latestDay - days;
    let ref: WeightEntry | null = null;
    for (const e of entries) {
      if (dayIndex(e.date) > target) break;
      ref = e;
    }
    if (ref && dayIndex(ref.date) >= target - Math.ceil(days / 3)) deltas.push({ days, change: kgIn(latestKg - toKg(ref), unit) });
  }
  let toGoal: number | null = null;
  if (goal) {
    const goalKg = toKg(goal);
    // Which side of the goal the log started on says which way it's heading: crossing it is reaching it.
    const losing = toKg(entries[0]) >= goalKg;
    const reached = losing ? latestKg <= goalKg : latestKg >= goalKg;
    toGoal = reached ? 0 : kgIn(Math.abs(latestKg - goalKg), unit);
  }
  return { latest, deltas, toGoal };
}

/** "−1.2", "+0.4", "0.0": a change to one decimal place with a real minus sign. */
export function formatChange(change: number): string {
  const r = Math.round(change * 10) / 10;
  if (r === 0) return '0.0';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}`;
}

/** The days an album's entries (sorted by date) cover. */
export function weightDomain(entries: readonly WeightEntry[]): DayDomain | null {
  if (entries.length === 0) return null;
  return { from: dayIndex(entries[0].date), to: dayIndex(entries[entries.length - 1].date) };
}

/** Two date axes as one that covers both. */
export function unionDomain(a: DayDomain | null, b: DayDomain | null): DayDomain | null {
  if (!a) return b;
  if (!b) return a;
  return { from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) };
}

/** The smallest vertical span the chart shows, in the display unit, so day-to-day noise isn't blown up. */
const MIN_SPAN = { kg: 2, lb: 4 } as const;

/**
 * Chart geometry in a w×h box over `domain`: a dot per entry, a line joining them that breaks
 * across gaps longer than a week, and the goal's height (null without one).
 */
export function weightGeometry(
  entries: readonly WeightEntry[],
  unit: WeightUnit,
  w: number,
  h: number,
  domain: DayDomain,
  goal?: WeightValue,
) {
  const values = entries.map((e) => inUnit(e, unit));
  const goalValue = goal ? inUnit(goal, unit) : null;
  const all = goalValue === null ? values : [...values, goalValue];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < MIN_SPAN[unit]) {
    const mid = (hi + lo) / 2;
    lo = mid - MIN_SPAN[unit] / 2;
    hi = mid + MIN_SPAN[unit] / 2;
  }
  // A little room above and below so dots at the extremes aren't cut in half.
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const span = Math.max(1, domain.to - domain.from);
  // A one-day axis puts its single day in the middle.
  const x = (day: number) => (domain.to === domain.from ? w / 2 : ((day - domain.from) / span) * w);
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  let line = '';
  let prev: number | null = null;
  const dots = entries.map((e, i) => {
    const day = dayIndex(e.date);
    const px = x(day);
    const py = y(values[i]);
    line += `${prev === null || day - prev > MAX_LINE_GAP_DAYS ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
    prev = day;
    return { x: px, y: py, date: e.date };
  });
  return { dots, line, goalY: goalValue === null ? null : y(goalValue) };
}
