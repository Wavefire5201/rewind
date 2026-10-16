import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { FontProvider } from '@/context/FontContext';
import { Pressed } from '@/constants/theme';
import ExportSheet from '@/components/timelapse/ExportSheet';
import ImportSheet from '@/components/ui/ImportSheet';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
import TextInputModal from '@/components/ui/TextInputModal';
import AlignToggle from '@/components/timelapse/AlignToggle';
import SpeedSelector from '@/components/timelapse/SpeedSelector';
import { TimelapseEmpty } from '@/components/timelapse/TimelapseView';
import { pressState } from '../helpers/pressedPressable';

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => require('../helpers/pressedPressable').pressablePressedMock());

// Equivalent actions give the same feedback: dismissing a sheet or dialog taps, like
// closing the photo viewer does, and text buttons dim by the same amount.
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));
jest.mock('@/components/timelapse/TimelapsePlayer', () => () => null);
jest.mock('@/hooks/useFaceScanBackfill', () => ({ useFaceScanBackfill: () => ({ scanning: false, done: 0, total: 0 }) }));
jest.mock('@/context/AppContext', () => ({ useAppContext: () => ({ updatePhotos: jest.fn() }) }));

const inFonts = (ui: React.ReactElement) => render(<FontProvider>{ui}</FontProvider>);
beforeEach(() => {
  jest.clearAllMocks();
  pressState.pressed = false;
});

it.each([
  ['ExportSheet', (onClose: () => void) => <ExportSheet visible onSelect={jest.fn()} onClose={onClose} />],
  ['ImportSheet', (onClose: () => void) => <ImportSheet visible onSelect={jest.fn()} onClose={onClose} />],
  ['DateRangeSheet', (onClose: () => void) => <DateRangeSheet visible dates={['2026-03-01']} startDate="2026-03-01" endDate="2026-03-01" onApply={jest.fn()} onClose={onClose} />],
])('%s taps when closed by its button or its backdrop', async (_name, make) => {
  const onClose = jest.fn();
  await inFonts(make(onClose));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Close' })));
  await act(async () => fireEvent.press(screen.getByTestId('sheet-backdrop')));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
});

it('TextInputModal taps on cancel', async () => {
  const onCancel = jest.fn();
  await inFonts(<TextInputModal visible title="rename album" onConfirm={jest.fn()} onCancel={onCancel} />);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cancel' })));
  expect(onCancel).toHaveBeenCalled();
  expect(Haptics.impactAsync).toHaveBeenCalled();
});

it('the empty timelapse taps on "adjust range"', async () => {
  const onAdjust = jest.fn();
  await inFonts(<TimelapseEmpty message="no photos" hasDateFilter onAdjustRange={onAdjust} />);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Adjust date range' })));
  expect(onAdjust).toHaveBeenCalled();
  expect(Haptics.impactAsync).toHaveBeenCalled();
});

it('the speed and align toggles dim like every other text button', async () => {
  pressState.pressed = true;
  await inFonts(<SpeedSelector selectedSpeed={1} onSelect={jest.fn()} trailing={<AlignToggle enabled onToggle={jest.fn()} />} />);
  const controls = [...screen.getAllByRole('button'), screen.getByRole('switch', { name: 'align faces' })];
  expect(controls.length).toBeGreaterThan(2);
  for (const control of controls) {
    expect(StyleSheet.flatten(control.props.style).opacity).toBe(Pressed.text);
  }
});
