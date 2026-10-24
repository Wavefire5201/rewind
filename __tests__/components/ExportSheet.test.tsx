import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import ExportSheet from '@/components/timelapse/ExportSheet';
import { getNotices, resetNoticesForTests } from '@/utils/notify';

jest.mock('react-native-gesture-handler', () => require('../helpers/gestureHandlerMock').gestureHandlerMock);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

beforeEach(() => resetNoticesForTests());
afterEach(() => resetNoticesForTests());

it("an export that isn't built yet says so instead of starting", async () => {
  const onSelect = jest.fn();
  await render(<FontProvider><ExportSheet visible onSelect={onSelect} onClose={jest.fn()} /></FontProvider>);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'animated gif, coming soon' })));
  expect(onSelect).not.toHaveBeenCalled();
  expect(getNotices()).toEqual([expect.objectContaining({ title: 'coming soon', tone: 'info' })]);
});
