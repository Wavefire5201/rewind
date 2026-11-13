import {
  formatChange, formatWeight, inUnit, isValidWeight, parseWeightInput, toKg, unionDomain, unitFor, validRangeText,
  weightDomain, weightGeometry, weightInputText, weightReadout,
} from '@/utils/weight';
import { dayIndex } from '@/utils/dates';
import type { WeightEntry } from '@/types';

const entry = (date: string, value: number, unit: 'lb' | 'kg' = 'lb'): WeightEntry => ({
  albumId: 'a', date, value, unit, updatedAt: `${date}T08:00:00.000Z`,
});

describe('units', () => {
  it('maps the setting to a unit', () => {
    expect(unitFor('imperial')).toBe('lb');
    expect(unitFor('metric')).toBe('kg');
  });

  it('converts for display without touching the entry', () => {
    const w = entry('2026-01-01', 176.4);
    expect(toKg(w)).toBeCloseTo(80.01, 2);
    expect(inUnit(w, 'kg')).toBeCloseTo(80.01, 2);
    expect(inUnit(w, 'lb')).toBe(176.4);
    expect(inUnit({ value: 80, unit: 'kg' }, 'lb')).toBeCloseTo(176.37, 2);
    expect(formatWeight(w, 'kg')).toBe('80.0 kg');
    expect(formatWeight(w, 'lb')).toBe('176.4 lb');
    expect(w.value).toBe(176.4);
  });

  it('fills an input with one decimal, or a whole number bare', () => {
    expect(weightInputText({ value: 80, unit: 'kg' }, 'kg')).toBe('80');
    expect(weightInputText({ value: 80, unit: 'kg' }, 'lb')).toBe('176.4');
  });
});

describe('input', () => {
  it('reads a decimal, with a point or a comma, to one decimal place', () => {
    expect(parseWeightInput('172.4', 'lb')).toEqual({ value: 172.4, unit: 'lb' });
    expect(parseWeightInput(' 72,35 ', 'kg')).toEqual({ value: 72.4, unit: 'kg' });
    expect(parseWeightInput('180', 'lb')).toEqual({ value: 180, unit: 'lb' });
    expect(parseWeightInput('180.', 'lb')).toEqual({ value: 180, unit: 'lb' });
  });

  it('rejects empty, non-numbers and out-of-range weights', () => {
    for (const bad of ['', '  ', 'abc', '1.2.3', '-80', '1e2', 'NaN', 'Infinity']) {
      expect(parseWeightInput(bad, 'kg')).toBeNull();
    }
    expect(parseWeightInput('19', 'lb')).toBeNull();
    expect(parseWeightInput('20', 'lb')).not.toBeNull();
    expect(parseWeightInput('500', 'lb')).not.toBeNull();
    expect(parseWeightInput('501', 'lb')).toBeNull();
    expect(parseWeightInput('8.9', 'kg')).toBeNull();
    expect(parseWeightInput('227', 'kg')).not.toBeNull();
    expect(parseWeightInput('228', 'kg')).toBeNull();
  });

  it('checks stored weights the same way', () => {
    expect(isValidWeight({ value: 80, unit: 'kg' })).toBe(true);
    expect(isValidWeight({ value: Number.NaN, unit: 'kg' })).toBe(false);
    expect(isValidWeight({ value: 80, unit: 'st' as 'kg' })).toBe(false);
  });

  it('says the accepted range in the unit', () => {
    expect(validRangeText('lb')).toBe('20–500 lb');
    expect(validRangeText('kg')).toBe('9–227 kg');
  });
});

describe('weightReadout', () => {
  it('is null without entries', () => {
    expect(weightReadout([], 'lb')).toBeNull();
  });

  it('compares the latest with the last entry on or before 7, 30 and 90 days back, across a year boundary', () => {
    const log = [
      entry('2025-10-01', 190), // 99 days before
      entry('2025-10-10', 188), // 90 days before: the 90-day reference
      entry('2025-12-09', 184), // 30 days before
      entry('2025-12-31', 182), // 8 days before: the 7-day reference
      entry('2026-01-04', 181), // 4 days before: too recent for 7
      entry('2026-01-08', 180),
    ];
    const r = weightReadout(log, 'lb')!;
    expect(r.latest.date).toBe('2026-01-08');
    expect(r.deltas.map((d) => [d.days, Math.round(d.change * 10) / 10])).toEqual([[7, -2], [30, -4], [90, -8]]);
  });

  it("leaves out a change whose reference is far older than the window (a gap in the log)", () => {
    // The last entry before today's is 8 months old: no 7, 30 or 90-day change to speak of.
    expect(weightReadout([entry('2026-03-09', 172.7), entry('2026-11-13', 171.6)], 'lb')!.deltas).toEqual([]);
    // 10 days back still counts as "7 days" (within 3 of the target); 11 doesn't.
    expect(weightReadout([entry('2026-03-03', 180), entry('2026-03-13', 179)], 'lb')!.deltas.map((d) => d.days)).toEqual([7]);
    expect(weightReadout([entry('2026-03-02', 180), entry('2026-03-13', 179)], 'lb')!.deltas).toEqual([]);
  });

  it('leaves out a change the log is too young for', () => {
    const r = weightReadout([entry('2026-03-01', 180), entry('2026-03-10', 179)], 'lb')!;
    expect(r.deltas.map((d) => d.days)).toEqual([7]);
  });

  it('works out changes in kg across entries made in different units', () => {
    const r = weightReadout([entry('2026-01-01', 80, 'kg'), entry('2026-01-08', 174.2, 'lb')], 'kg')!;
    expect(r.deltas[0].change).toBeCloseTo(174.2 * 0.45359237 - 80, 5);
  });

  it('says how far the goal is, and that it is reached once crossed, either way', () => {
    const losing = [entry('2026-01-01', 180), entry('2026-02-01', 172.6)];
    expect(weightReadout(losing, 'lb', { value: 165, unit: 'lb' })!.toGoal).toBeCloseTo(7.6, 5);
    expect(weightReadout([...losing, entry('2026-03-01', 164)], 'lb', { value: 165, unit: 'lb' })!.toGoal).toBe(0);
    const gaining = [entry('2026-01-01', 60, 'kg'), entry('2026-02-01', 63, 'kg')];
    expect(weightReadout(gaining, 'kg', { value: 65, unit: 'kg' })!.toGoal).toBeCloseTo(2, 5);
    expect(weightReadout(gaining, 'kg', { value: 62, unit: 'kg' })!.toGoal).toBe(0);
    expect(weightReadout(gaining, 'kg')!.toGoal).toBeNull();
  });
});

it('formats a change with a real minus sign and one decimal', () => {
  expect(formatChange(-1.24)).toBe('−1.2');
  expect(formatChange(0.36)).toBe('+0.4');
  expect(formatChange(0.04)).toBe('0.0');
  expect(formatChange(-0.04)).toBe('0.0');
});

describe('domains', () => {
  it('spans the entries and joins two axes', () => {
    expect(weightDomain([])).toBeNull();
    const d = weightDomain([entry('2026-01-01', 1), entry('2026-02-01', 1)])!;
    expect(d.to - d.from).toBe(31);
    expect(unionDomain(d, null)).toBe(d);
    expect(unionDomain(null, d)).toBe(d);
    expect(unionDomain({ from: 0, to: 10 }, { from: 5, to: 20 })).toEqual({ from: 0, to: 20 });
  });
});

describe('weightGeometry', () => {
  const log = [entry('2026-01-01', 180), entry('2026-01-04', 179), entry('2026-01-20', 176)];
  const domain = weightDomain(log)!;

  it('places dots by day across the width and by value up the height', () => {
    const g = weightGeometry(log, 'lb', 190, 64, domain);
    expect(g.dots.map((d) => Math.round(d.x))).toEqual([0, 30, 190]);
    // Heavier is higher (smaller y), and everything stays inside the box.
    expect(g.dots[0].y).toBeLessThan(g.dots[2].y);
    for (const d of g.dots) expect(d.y).toBeGreaterThan(0), expect(d.y).toBeLessThan(64);
    expect(g.goalY).toBeNull();
  });

  it('breaks the line across a gap longer than a week', () => {
    const g = weightGeometry(log, 'lb', 190, 64, domain);
    expect(g.line.match(/[ML]/g)).toEqual(['M', 'L', 'M']);
  });

  it('keeps the goal in view', () => {
    const g = weightGeometry(log, 'lb', 190, 64, domain, { value: 150, unit: 'lb' });
    expect(g.goalY).not.toBeNull();
    expect(g.goalY!).toBeGreaterThan(g.dots[2].y);
    expect(g.goalY!).toBeLessThan(64);
  });

  it("doesn't blow a flat log's small wobble up to the full height", () => {
    const flat = [entry('2026-01-01', 180), entry('2026-01-02', 180.2)];
    const g = weightGeometry(flat, 'lb', 100, 64, weightDomain(flat)!);
    expect(Math.abs(g.dots[0].y - g.dots[1].y)).toBeLessThan(64 * 0.1);
  });

  it('follows a shared axis wider than the entries', () => {
    const wide = { from: domain.from - 19, to: domain.to };
    const g = weightGeometry(log, 'lb', 380, 64, wide);
    expect(Math.round(g.dots[0].x)).toBe(Math.round((19 / (dayIndex('2026-01-20') - wide.from)) * 380));
  });

  it('centres a single day', () => {
    const one = [entry('2026-01-01', 180)];
    expect(weightGeometry(one, 'lb', 100, 64, weightDomain(one)!).dots[0].x).toBe(50);
  });
});
