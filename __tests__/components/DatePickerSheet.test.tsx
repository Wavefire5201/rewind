import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { FontProvider } from '@/context/FontContext';
import DatePickerSheet from '@/components/ui/DatePickerSheet';
import { capturedGestures } from '../helpers/gestureHandlerMock';

jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const PHOTO_DATES = new Set(['2026-10-01', '2026-10-02', '2026-10-20']);

function renderPicker(props: Partial<React.ComponentProps<typeof DatePickerSheet>> = {}) {
  return render(
    <FontProvider>
      <DatePickerSheet visible value="2026-10-21" maxDate="2026-10-24" photoDates={PHOTO_DATES} onConfirm={jest.fn()} onClose={jest.fn()} {...props} />
    </FontProvider>,
  );
}

const day = (label: string) => screen.getByLabelText(label);
const press = (el: Parameters<typeof fireEvent.press>[0]) => act(async () => fireEvent.press(el));

beforeEach(() => jest.clearAllMocks());

it('opens on the month of value with it selected', async () => {
  await renderPicker();
  expect(screen.getByText('october 2026')).toBeTruthy();
  expect(day('october 21, 2026').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  expect(day('october 20, 2026').props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
});

it('future days cannot be picked', async () => {
  await renderPicker();
  expect(day('october 25, 2026').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  await press(day('october 25, 2026'));
  expect(day('october 21, 2026').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  expect(screen.getByRole('button', { name: 'use oct 21' })).toBeTruthy();
});

it('days with a photo are marked', async () => {
  await renderPicker();
  expect(day('october 1, 2026').props.accessibilityHint).toBe('has a photo');
  expect(day('october 20, 2026').props.accessibilityHint).toBe('has a photo');
  expect(day('october 3, 2026').props.accessibilityHint).toBeUndefined();
});

it('picks a day and confirms it, one tick per pick', async () => {
  const onConfirm = jest.fn();
  await renderPicker({ onConfirm });
  await press(day('october 3, 2026'));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  await press(screen.getByRole('button', { name: 'use oct 3' }));
  expect(onConfirm).toHaveBeenCalledWith('2026-10-03');
});

it('month arrows move between months and stop at the max month', async () => {
  await renderPicker();
  expect(screen.getByRole('button', { name: 'next month' }).props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  await press(screen.getByRole('button', { name: 'previous month' }));
  expect(screen.getByText('september 2026')).toBeTruthy();
  await press(screen.getByRole('button', { name: 'next month' }));
  expect(screen.getByText('october 2026')).toBeTruthy();
  // The selection stays on the day picked, whichever month is showing.
  expect(screen.getByRole('button', { name: 'use oct 21' })).toBeTruthy();
});

it('a sideways swipe changes month', async () => {
  // The month swipe is the horizontal pan (the sheet's own drag is vertical).
  const monthSwipe = () => capturedGestures.filter((g) => g.type === 'Pan' && g.config.activeOffsetX).at(-1)!;
  const swipe = (translationX: number) =>
    act(async () => { monthSwipe().handlers.onEnd({ translationX, velocityX: 0, translationY: 0, velocityY: 0 } as never); });
  await renderPicker();
  await swipe(120);
  expect(screen.getByText('september 2026')).toBeTruthy();
  await swipe(-120);
  expect(screen.getByText('october 2026')).toBeTruthy();
  await swipe(-120); // already at the max month
  expect(screen.getByText('october 2026')).toBeTruthy();
  await swipe(20); // too short
  expect(screen.getByText('october 2026')).toBeTruthy();
});

it('the title jumps to a year, then a month', async () => {
  await renderPicker({ photoDates: new Set(['2019-03-05']) });
  await press(screen.getByText('october 2026'));
  await press(screen.getByRole('button', { name: '2019' }));
  await press(screen.getByRole('button', { name: 'mar' }));
  expect(screen.getByText('march 2019')).toBeTruthy();
  expect(day('march 5, 2019').props.accessibilityHint).toBe('has a photo');
});

it("months after the max date can't be picked in the month grid", async () => {
  await renderPicker();
  await press(screen.getByText('october 2026'));
  await press(screen.getByRole('button', { name: '2026' }));
  expect(screen.getByRole('button', { name: 'nov' }).props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  expect(screen.getByRole('button', { name: 'oct' }).props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
});

it('closes from its close button with a tap', async () => {
  const onClose = jest.fn();
  await renderPicker({ onClose });
  await press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});
