import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { FontProvider } from '@/context/FontContext';
import ConfirmLayer from '@/components/ui/overlay/ConfirmLayer';
import BottomSheet from '@/components/ui/BottomSheet';
import { confirm, resetConfirmForTests } from '@/utils/confirm';
import { resetNoticesForTests } from '@/utils/notify';

jest.mock('react-native-reanimated', () => require('../../helpers/reanimatedMock').reanimatedMock);
jest.mock('react-native-gesture-handler', () => require('../../helpers/gestureHandlerMock').gestureHandlerMock);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const inFonts = (ui: React.ReactElement) => render(<FontProvider>{ui}</FontProvider>);
const ask = () => {
  let answer: Promise<boolean> = Promise.resolve(false);
  return {
    open: () => act(async () => { answer = confirm({ title: 'delete album?', message: '"trip" and all its photos will be deleted.', confirmLabel: 'delete album', destructive: true }); }),
    result: () => answer,
  };
};

beforeEach(() => {
  resetConfirmForTests();
  jest.clearAllMocks();
});
afterEach(() => resetNoticesForTests());

it('shows the question and resolves true from the primary button', async () => {
  await inFonts(<ConfirmLayer />);
  const q = ask();
  await q.open();
  expect(screen.getByText('delete album?')).toBeTruthy();
  expect(screen.getByText('"trip" and all its photos will be deleted.')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'delete album' })));
  await expect(q.result()).resolves.toBe(true);
});

it('resolves false when dismissed', async () => {
  await inFonts(<ConfirmLayer />);
  const q = ask();
  await q.open();
  await act(async () => fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true })));
  await expect(q.result()).resolves.toBe(false);
});

it('the primary button plays no haptic; cancel taps', async () => {
  await inFonts(<ConfirmLayer />);
  const first = ask();
  await first.open();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'delete album' })));
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();

  const second = ask();
  await second.open();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'cancel' })));
  await expect(second.result()).resolves.toBe(false);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
});

it('answers once, however many times it is pressed', async () => {
  await inFonts(<ConfirmLayer />);
  const q = ask();
  await q.open();
  const later = confirm({ title: 'next question', confirmLabel: 'ok' });
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'delete album' }));
    fireEvent.press(screen.getByRole('button', { name: 'cancel' }));
  });
  await expect(q.result()).resolves.toBe(true);
  // The second press didn't answer the question queued behind it.
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ok' })));
  await expect(later).resolves.toBe(true);
});

it('waits for an open bottom sheet to close before presenting', async () => {
  const ui = (sheetOpen: boolean) => (
    <>
      <BottomSheet visible={sheetOpen} onClose={jest.fn()}><Text>export</Text></BottomSheet>
      <ConfirmLayer />
    </>
  );
  const { rerender } = await inFonts(ui(true));
  const q = ask();
  await q.open();
  expect(screen.queryByText('delete album?')).toBeNull();
  await act(async () => rerender(<FontProvider>{ui(false)}</FontProvider>));
  expect(screen.getByText('delete album?')).toBeTruthy();
});

it('only the top layer presents it', async () => {
  await inFonts(<><ConfirmLayer testID="a" /><ConfirmLayer testID="b" /></>);
  const q = ask();
  await q.open();
  expect(screen.getAllByText('delete album?')).toHaveLength(1);
  expect(within(screen.getByTestId('b')).getByText('delete album?')).toBeTruthy();
});

it('stays with the layer that opened it when a newer layer mounts', async () => {
  const { rerender } = await inFonts(<ConfirmLayer testID="a" />);
  const q = ask();
  await q.open();
  await act(async () => rerender(<FontProvider><ConfirmLayer testID="a" /><ConfirmLayer testID="b" /></FontProvider>));
  expect(screen.getAllByText('delete album?')).toHaveLength(1);
  expect(within(screen.getByTestId('a')).getByText('delete album?')).toBeTruthy();
});
