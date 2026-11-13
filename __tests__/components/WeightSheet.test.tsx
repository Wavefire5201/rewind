import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import WeightSheet from '@/components/weight/WeightSheet';
import { FontProvider } from '@/context/FontContext';
import type { WeightEntry } from '@/types';

const logged: WeightEntry = { albumId: 'a', date: '2026-03-09', value: 80, unit: 'kg', updatedAt: '2026-03-09T08:00:00.000Z' };
const entryFor = (date: string) => (date === logged.date ? logged : undefined);

const renderSheet = (props: Partial<React.ComponentProps<typeof WeightSheet>> = {}) =>
  render(
    <FontProvider>
      <WeightSheet visible date="2026-03-10" today="2026-03-10" unit="kg" entryFor={entryFor}
        onSave={jest.fn()} onDelete={jest.fn()} onClose={jest.fn()} {...props} />
    </FontProvider>,
  );

it('logs a weight for today', async () => {
  const onSave = jest.fn();
  await renderSheet({ onSave });
  expect(screen.getByText('today')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Delete weight' })).toBeNull();
  await act(async () => fireEvent.changeText(screen.getByLabelText('Weight in kg'), '79.3'));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Save weight' })));
  expect(onSave).toHaveBeenCalledWith('2026-03-10', { value: 79.3, unit: 'kg' });
});

it("steps back to a day that has one, shows it, and can delete it, but can't step past today", async () => {
  const onDelete = jest.fn();
  await renderSheet({ onDelete });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Next day' })));
  expect(screen.getByText('today')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Previous day' })));
  expect(screen.getByText('march 9, 2026')).toBeTruthy();
  expect(screen.getByDisplayValue('80')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete weight' })));
  expect(onDelete).toHaveBeenCalledWith('2026-03-09');
});

it('opens on a given day, in the display unit', async () => {
  await renderSheet({ date: '2026-03-09', unit: 'lb' });
  expect(screen.getByDisplayValue('176.4')).toBeTruthy();
});

it('says what it takes instead of saving a value that is not a weight', async () => {
  const onSave = jest.fn();
  await renderSheet({ onSave });
  await act(async () => fireEvent.changeText(screen.getByLabelText('Weight in kg'), '400'));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Save weight' })));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText('enter a weight between 9–227 kg')).toBeTruthy();
});

it("closes without saving when the day's weight wasn't changed, so a converted value isn't re-stored rounded", async () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  await renderSheet({ date: '2026-03-09', unit: 'lb', onSave, onClose });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Save weight' })));
  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
