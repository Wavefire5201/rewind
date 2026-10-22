import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
import { FontProvider } from '@/context/FontContext';

jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// Three years of daily photos.
const DATES = Array.from({ length: 1000 }, (_, i) => new Date(Date.UTC(2023, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));
const dateButtons = () => screen.queryAllByRole('button').filter((b) => /^\w+ \d+, \d{4}$/.test(String(b.props.accessibilityLabel)));

async function openStartList(start: string) {
  await render(
    <FontProvider>
      <DateRangeSheet visible dates={DATES} startDate={start} endDate={DATES[DATES.length - 1]} onApply={jest.fn()} onClose={jest.fn()} />
    </FontProvider>,
  );
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Start date' })));
}

it('renders only the dates near the visible part of the list, not all of them', async () => {
  await openStartList(DATES[0]);
  expect(dateButtons().length).toBeGreaterThan(0);
  expect(dateButtons().length).toBeLessThan(100);
});

it('opens the list at the selected date', async () => {
  await openStartList(DATES[600]); // 2024-08-23
  expect(screen.getByRole('button', { name: 'August 23, 2024' }).props.accessibilityState).toEqual(
    expect.objectContaining({ selected: true }),
  );
});
