import { clampDay, dayRange, shiftDay } from '@/utils/days';

describe('shiftDay', () => {
  it('moves across month ends and the clock change', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDay('2026-03-07', 1)).toBe('2026-03-08');
    expect(shiftDay('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('dayRange', () => {
  it('lists every day, inclusive, across a year end', () => {
    expect(dayRange('2025-12-30', '2026-01-02')).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
  });

  it('neither skips nor repeats a day over the US clock change (this file runs in Chicago)', () => {
    expect(dayRange('2026-03-07', '2026-03-09')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
    expect(dayRange('2026-10-31', '2026-11-02')).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('is empty when the start is after the end', () => {
    expect(dayRange('2026-03-09', '2026-03-08')).toEqual([]);
  });

  it('covers a 1,000-day album', () => {
    const days = dayRange('2023-06-01', '2026-02-24');
    expect(days).toHaveLength(1000);
    expect(days[999]).toBe('2026-02-24');
  });
});

describe('clampDay', () => {
  const start = '2026-01-01';
  const end = '2026-03-01';
  it('opens on the last day when there is no usable date', () => {
    expect(clampDay(undefined, start, end)).toBe(end);
    expect(clampDay('junk', start, end)).toBe(end);
    expect(clampDay('2026-3-1', start, end)).toBe(end);
  });

  it('keeps a date inside the range and pulls one outside it to the nearest end', () => {
    expect(clampDay('2026-02-10', start, end)).toBe('2026-02-10');
    expect(clampDay('2025-12-01', start, end)).toBe(start);
    expect(clampDay('2027-01-01', start, end)).toBe(end);
  });
});
