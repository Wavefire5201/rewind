import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import MonthHeader from '@/components/timeline/MonthHeader';
import ExportSheet from '@/components/timelapse/ExportSheet';
import ImportSheet from '@/components/ui/ImportSheet';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
import ImportPhotoModal from '@/components/ImportPhotoModal';
import TimerSelector from '@/components/camera/TimerSelector';

// Every control a screen reader user meets must say what it is, and small ones must
// still be easy to hit (44 dp, counting hitSlop).
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const inFonts = (ui: React.ReactElement) => render(<FontProvider>{ui}</FontProvider>);

/** Width of a control's touch area: its style width plus any hitSlop on both sides. */
function touchWidth(name: string): number {
  const el = screen.getByRole('button', { name });
  const style = StyleSheet.flatten(typeof el.props.style === 'function' ? el.props.style({ pressed: false }) : el.props.style) ?? {};
  const slop = el.props.hitSlop;
  const extra = typeof slop === 'number' ? 2 * slop : (slop?.left ?? 0) + (slop?.right ?? 0);
  return (Number(style.width) || 0) + extra;
}

it('MonthHeader: labelled month buttons, big enough to hit', async () => {
  await inFonts(<MonthHeader year={2026} month={3} onPrev={jest.fn()} onNext={jest.fn()} onTitlePress={jest.fn()} />);
  expect(touchWidth('Previous month')).toBeGreaterThanOrEqual(44);
  expect(touchWidth('Next month')).toBeGreaterThanOrEqual(44);
  expect(screen.getByRole('button', { name: 'Choose month' })).toBeTruthy();
});

it('ExportSheet: a labelled close button and labelled options', async () => {
  await inFonts(<ExportSheet visible onSelect={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(5);
});

it('ImportSheet: a labelled close button', async () => {
  await inFonts(<ImportSheet visible onSelect={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
});

it('DateRangeSheet: every control is labelled, including the dates in the list', async () => {
  await inFonts(
    <DateRangeSheet visible dates={['2026-03-01', '2026-03-02']} startDate="2026-03-01" endDate="2026-03-02" onApply={jest.fn()} onClose={jest.fn()} />,
  );
  for (const name of ['Close', 'Start date', 'End date', 'Show all dates', 'Apply date range']) {
    expect(screen.getByRole('button', { name })).toBeTruthy();
  }
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Start date' })));
  expect(screen.getByRole('button', { name: 'March 2, 2026' })).toBeTruthy();
});

it('ImportPhotoModal: a labelled close button and date button', async () => {
  await inFonts(
    <ImportPhotoModal visible photos={[{ uri: 'file:///a.jpg', suggestedDate: '2026-03-01' }]} photoDates={new Set()} onSave={jest.fn()} onCancel={jest.fn()} />,
  );
  expect(screen.getByRole('button', { name: 'Cancel import' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Change date' })).toBeTruthy();
});

it('TimerSelector: labelled pills that say which one is selected', async () => {
  await inFonts(<TimerSelector visible selectedDuration={3} onSelect={jest.fn()} />);
  const three = screen.getByRole('button', { name: '3 second timer' });
  expect(three.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  expect(screen.getByRole('button', { name: 'Timer off' }).props.accessibilityState).toEqual(
    expect.objectContaining({ selected: false }),
  );
  expect(three.props.hitSlop).toBeTruthy();
});
