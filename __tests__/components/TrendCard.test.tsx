import { render, screen, fireEvent } from '@testing-library/react-native';
import TrendCard from '@/components/timeline/TrendCard';
import { FontProvider } from '@/context/FontContext';
import { buildFaceTrend, type TrendPhoto } from '@/utils/faceTrend';
import type { FaceMeasure, WeightEntry, WeightValue } from '@/types';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children, ...p }: { children?: React.ReactNode }) => <View {...p}>{children}</View>;
  return { __esModule: true, default: Box, Svg: Box, Path: Box, Circle: Box, Line: Box };
});

const base: FaceMeasure = { ipd: 200, closeness: 0.2, jaw: 2, lowJaw: 1.5, cheek: 2.5, yaw: 0, pitch: 10, roll: 0, smile: 0, jawOpen: 0 };
const iso = (d: number) => new Date(Date.UTC(2025, 0, 1) + d * 86400000).toISOString().slice(0, 10);
const photos = (n: number, k = 1): TrendPhoto[] =>
  Array.from({ length: n }, (_, d) => ({ id: `p${d}`, date: iso(d), faceScan: { v: 2, eyes: null, width: 1, height: 1, measure: { ...base, jaw: 2 * (d < n / 2 ? 1 : k), lowJaw: 1.5 * (d < n / 2 ? 1 : k) } } }));
const idle = { scanning: false, done: 0, total: 0 };

const renderCard = (
  p: TrendPhoto[], progress = idle, onSelectDate = jest.fn(), onCompare = jest.fn(), waiting = false,
  weights: WeightEntry[] = [], onLogWeight = jest.fn(), goal?: WeightValue,
) =>
  render(
    <FontProvider>
      <TrendCard
        face={{ photos: p, trend: buildFaceTrend(p), waiting, progress }}
        weights={weights}
        unit="lb"
        goal={goal}
        onSelectDate={onSelectDate}
        onCompare={onCompare}
        onLogWeight={onLogWeight}
      />
    </FontProvider>,
  );

const weight = (d: number, value: number): WeightEntry => ({ albumId: 'a', date: iso(d), value, unit: 'lb', updatedAt: '2025-01-01T00:00:00.000Z' });
const layout = (testID: string) => fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { width: 300, height: 64 } } });

it('says how many comparable photos it still needs instead of drawing a chart', async () => {
  await renderCard(photos(12));
  expect(screen.getByText('needs 30 comparable photos (12 so far)')).toBeTruthy();
  expect(screen.queryByTestId('face-chart')).toBeNull();
});

it('shows scan progress while measuring', async () => {
  await renderCard(photos(12), { scanning: true, done: 40, total: 482 });
  expect(screen.getByText('measuring 40/482')).toBeTruthy();
});

it('shows the headline and chart, and opens compare', async () => {
  const onCompare = jest.fn();
  await renderCard(photos(100, 0.96), idle, jest.fn(), onCompare);
  expect(screen.getByText(/lower face 4% thinner since/)).toBeTruthy();
  expect(screen.getByTestId('face-chart')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Compare two days' }));
  expect(onCompare).toHaveBeenCalled();
});

it('opens the photo nearest a tap on the chart', async () => {
  const onSelectDate = jest.fn();
  await renderCard(photos(100), idle, onSelectDate);
  const chart = screen.getByTestId('face-chart');
  await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 300, height: 120 } } });
  await fireEvent.press(chart, { nativeEvent: { locationX: 0, locationY: 60 } });
  expect(onSelectDate).toHaveBeenCalledWith('2025-01-01');
});

it('says measuring is coming instead of "0 so far" while photos wait to be scanned', async () => {
  await renderCard([], idle, jest.fn(), jest.fn(), true);
  expect(screen.getByText('measuring soon')).toBeTruthy();
  expect(screen.queryByText(/so far/)).toBeNull();
});

it('draws all the daily dots as one path', async () => {
  await renderCard(photos(100));
  const chart = screen.getByTestId('face-chart');
  await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 300, height: 120 } } });
  expect(String(screen.getByTestId('face-chart-dots').props.d).match(/M/g)).toHaveLength(100);
});

describe('the weight strip', () => {
  it('asks for a first weight when there are none, and + log opens the sheet on today', async () => {
    const onLogWeight = jest.fn();
    await renderCard(photos(12), idle, jest.fn(), jest.fn(), false, [], onLogWeight);
    expect(screen.getByText('no weights yet. tap + log to add one.')).toBeTruthy();
    expect(screen.queryByTestId('weight-chart')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Log weight' }));
    expect(onLogWeight).toHaveBeenCalledWith();
  });

  it('shows the latest weight, its changes, and how far the goal is', async () => {
    await renderCard(photos(12), idle, jest.fn(), jest.fn(), false, [weight(0, 182), weight(60, 178), weight(82, 176), weight(90, 174.6)], jest.fn(), { value: 165, unit: 'lb' });
    expect(screen.getByText('174.6 lb · 9.6 lb to goal')).toBeTruthy();
    // 7 days back is day 82, 30 back day 60, 90 back day 0.
    expect(screen.getByText('7d −1.4 · 30d −3.4 · 90d −7.4')).toBeTruthy();
  });

  it('draws a dot per weight and the goal line, and opens the nearest day on a tap', async () => {
    const onLogWeight = jest.fn();
    await renderCard([], idle, jest.fn(), jest.fn(), false, [weight(0, 182), weight(3, 181), weight(30, 178)], onLogWeight, { value: 170, unit: 'lb' });
    await layout('weight-chart');
    expect(String(screen.getByTestId('weight-chart-dots').props.d).match(/M/g)).toHaveLength(3);
    // The 27-day gap breaks the line: a move to the last dot, not a line to it.
    expect(String(screen.getByTestId('weight-chart-line').props.d).match(/M/g)).toHaveLength(2);
    expect(screen.getByTestId('weight-goal-line')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('weight-chart'), { nativeEvent: { locationX: 290, locationY: 30 } });
    expect(onLogWeight).toHaveBeenCalledWith(iso(30));
  });

  it('puts face and weight on one date axis, so the same day lines up in both', async () => {
    const onSelectDate = jest.fn();
    // Face photos cover days 0–99; weights start on day 50 and run past them to day 199.
    await renderCard(photos(100), idle, onSelectDate, jest.fn(), false, [weight(50, 180), weight(199, 175)]);
    await layout('face-chart');
    await layout('weight-chart');
    const faceDots = String(screen.getByTestId('face-chart-dots').props.d).match(/M([\d.]+)/g)!.map((m) => Number(m.slice(1)));
    const weightDots = String(screen.getByTestId('weight-chart-dots').props.d).match(/M([\d.]+)/g)!.map((m) => Number(m.slice(1)));
    // Day 50 is a face photo and a weight: the same x in both strips.
    expect(weightDots[0]).toBeCloseTo(faceDots[50], 0);
    expect(faceDots[0]).toBe(0);
    expect(weightDots[1]).toBeCloseTo(300, 0);
  });

  it('names the card for weight alone where face scanning is unavailable', async () => {
    await render(
      <FontProvider>
        <TrendCard face={null} weights={[weight(0, 180)]} unit="kg" onSelectDate={jest.fn()} onCompare={jest.fn()} onLogWeight={jest.fn()} />
      </FontProvider>,
    );
    expect(screen.getByText('weight')).toBeTruthy();
    expect(screen.getByText('81.6 kg')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Compare two days' })).toBeNull();
  });
});
