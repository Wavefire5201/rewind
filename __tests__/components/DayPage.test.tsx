import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import DayPage, { type DayPageProps } from '@/components/day/DayPage';
import { FontProvider } from '@/context/FontContext';
import type { PhotoEntry } from '@/types';

jest.mock('@/components/ui/PhotoImage', () => () => null);
jest.mock('react-native-gesture-handler', () => {
  const chain = (): unknown => new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : () => chain()) });
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: chain, Exclusive: chain, Race: chain },
  };
});
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const photo: PhotoEntry = {
  id: 'p1', albumId: 'a', date: '2026-03-05', imageUri: 'file:///a.jpg', caption: 'first',
  capturedAt: '2026-03-05T14:30:00.000Z', cameraDirection: 'front',
};

async function renderPage(props: Partial<DayPageProps> = {}) {
  const handlers = {
    onTakePhoto: jest.fn(), onAddFromLibrary: jest.fn(), onShare: jest.fn(), onDelete: jest.fn(),
    onCaption: jest.fn(), onWeight: jest.fn(),
  };
  const all: DayPageProps = {
    date: '2026-03-05', dayNumber: 5, isToday: false, photo: null, weight: undefined, unit: 'lb',
    readout: null, use24h: false, width: 360, photoHeight: 480, ...handlers, ...props,
  };
  await render(<FontProvider><DayPage {...all} /></FontProvider>);
  return all;
}

it('shows the date and the day number', async () => {
  await renderPage();
  expect(screen.getByText('march 5, 2026 · day 5')).toBeTruthy();
});

it('an empty past day offers the library, not the camera', async () => {
  await renderPage();
  expect(screen.getByRole('button', { name: 'Add photo from library' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete photo' })).toBeNull();
});

it('an empty today offers both', async () => {
  const p = await renderPage({ isToday: true });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Take photo' })));
  expect(p.onTakePhoto).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Add photo from library' })).toBeTruthy();
});

it('a photo day shows its time, readout, caption and actions', async () => {
  await renderPage({ photo, readout: 'face about your 30-day average' });
  expect(screen.getByText(/8:30/)).toBeTruthy();
  expect(screen.getByText('face about your 30-day average')).toBeTruthy();
  expect(screen.getByText('first')).toBeTruthy();
  for (const name of ['Share photo', 'Replace photo', 'Delete photo']) expect(screen.getByRole('button', { name })).toBeTruthy();
});

it('replace on a past day picks from the library; on today it opens the camera', async () => {
  const past = await renderPage({ photo });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Replace photo' })));
  expect(past.onAddFromLibrary).toHaveBeenCalled();
  expect(past.onTakePhoto).not.toHaveBeenCalled();
  await screen.unmount();
  const today = await renderPage({ photo, isToday: true });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Replace photo' })));
  expect(today.onTakePhoto).toHaveBeenCalled();
});

it('the caption is limited to 140 and saves', async () => {
  const p = await renderPage({ photo });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Edit caption' })));
  const input = screen.getByDisplayValue('first');
  expect(input.props.maxLength).toBe(140);
  await act(async () => fireEvent.changeText(input, 'second'));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Save caption' })));
  expect(p.onCaption).toHaveBeenCalledWith('second');
});

it('the weight field is there with or without a photo and reports its commit', async () => {
  const p = await renderPage();
  await act(async () => fireEvent.changeText(screen.getByLabelText('Weight in lb'), '180'));
  await act(async () => fireEvent(screen.getByLabelText('Weight in lb'), 'blur'));
  expect(p.onWeight).toHaveBeenCalledWith({ value: 180, unit: 'lb' });
  await screen.unmount();
  await renderPage({ photo });
  expect(screen.getByLabelText('Weight in lb')).toBeTruthy();
});

it('delete calls onDelete (the screen asks first)', async () => {
  const p = await renderPage({ photo });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete photo' })));
  expect(p.onDelete).toHaveBeenCalled();
});
