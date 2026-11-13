import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import WeightField from '@/components/weight/WeightField';
import { FontProvider } from '@/context/FontContext';
import type { WeightEntry, WeightUnit } from '@/types';

const entry = (value: number, unit: WeightUnit = 'kg', date = '2026-03-05'): WeightEntry => ({
  albumId: 'a', date, value, unit, updatedAt: `${date}T08:00:00.000Z`,
});

const ui = (props: Partial<React.ComponentProps<typeof WeightField>> & { onCommit: jest.Mock }) => (
  <FontProvider>
    <WeightField entry={undefined} unit="lb" {...props} />
  </FontProvider>
);

const field = (unit = 'lb') => screen.getByLabelText(`Weight in ${unit}`);

it('commits a new weight on submit', async () => {
  const onCommit = jest.fn();
  await render(ui({ onCommit }));
  await act(async () => fireEvent.changeText(field(), '172,4'));
  await act(async () => fireEvent(field(), 'submitEditing'));
  expect(onCommit).toHaveBeenCalledWith({ value: 172.4, unit: 'lb' });
});

it('commits on blur, so a swipe away saves it', async () => {
  const onCommit = jest.fn();
  await render(ui({ onCommit, unit: 'kg' }));
  await act(async () => fireEvent.changeText(field('kg'), '80'));
  await act(async () => fireEvent(field('kg'), 'blur'));
  expect(onCommit).toHaveBeenCalledWith({ value: 80, unit: 'kg' });
});

it('an emptied field deletes the weight', async () => {
  const onCommit = jest.fn();
  await render(ui({ onCommit, unit: 'kg', entry: entry(80) }));
  await act(async () => fireEvent.changeText(field('kg'), ''));
  await act(async () => fireEvent(field('kg'), 'blur'));
  expect(onCommit).toHaveBeenCalledWith(null);
});

it('an empty field with no weight commits nothing', async () => {
  const onCommit = jest.fn();
  await render(ui({ onCommit }));
  await act(async () => fireEvent(field(), 'blur'));
  expect(onCommit).not.toHaveBeenCalled();
});

it('an unchanged value commits nothing, so a converted weight is not re-stored rounded', async () => {
  const onCommit = jest.fn();
  await render(ui({ onCommit, entry: entry(80) }));
  expect(screen.getByDisplayValue('176.4')).toBeTruthy();
  await act(async () => fireEvent(field(), 'blur'));
  expect(onCommit).not.toHaveBeenCalled();
});

it('an invalid value shows the range and commits nothing', async () => {
  const onCommit = jest.fn();
  await render(ui({ onCommit }));
  await act(async () => fireEvent.changeText(field(), '9000'));
  await act(async () => fireEvent(field(), 'blur'));
  expect(onCommit).not.toHaveBeenCalled();
  expect(screen.getByText('enter a weight between 20–500 lb')).toBeTruthy();
});

it('shows the new day when the entry changes', async () => {
  const onCommit = jest.fn();
  const view = await render(ui({ onCommit, unit: 'kg', entry: entry(80) }));
  expect(screen.getByDisplayValue('80')).toBeTruthy();
  await act(async () => view.rerender(ui({ onCommit, unit: 'kg', entry: entry(81.5, 'kg', '2026-03-06') })));
  expect(screen.getByDisplayValue('81.5')).toBeTruthy();
});
