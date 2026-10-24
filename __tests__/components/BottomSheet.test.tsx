import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { FontProvider } from '@/context/FontContext';
import BottomSheet from '@/components/ui/BottomSheet';
import { useOpenSheetCount } from '@/components/ui/overlay/layers';
import { lastGesture, resetCapturedGestures } from '../helpers/gestureHandlerMock';
import { flushUiWrites } from '../helpers/reanimatedMock';

jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
jest.mock('react-native-gesture-handler', () => require('../helpers/gestureHandlerMock').gestureHandlerMock);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const { useReducedMotion } = jest.requireMock('react-native-reanimated') as { useReducedMotion: jest.Mock };

function OpenSheets() {
  return <Text testID="open-sheets">{useOpenSheetCount()}</Text>;
}

const sheet = (props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) => (
  <FontProvider>
    <OpenSheets />
    <BottomSheet visible onClose={jest.fn()} {...props}>
      <Text>sheet body</Text>
    </BottomSheet>
  </FontProvider>
);

/** Renders the sheet and lets its open animation land (the mock's animations finish at once,
 *  but their values reach the screen on the next render, as on the device's next frame). */
async function renderOpen(props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) {
  const view = await render(sheet(props));
  await act(async () => view.rerender(sheet(props)));
  return view;
}

/** Lays the sheet out at a phone-like height, so drag thresholds are measured against it. */
const layOut = (height: number) =>
  act(async () => {
    fireEvent(screen.getByTestId('bottom-sheet'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height } } });
    flushUiWrites(); // the UI thread picks up the measured height
  });

/** The scrim is for sighted taps: screen readers ignore everything beside the modal sheet (they
 *  close it with its Close button or the escape gesture), so it's queried as a hidden element. */
const pressScrim = () =>
  act(async () => fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true })));

const drag = (translationY: number, velocityY = 0) =>
  act(async () => { lastGesture('Pan').handlers.onEnd({ translationY, velocityY, translationX: 0, velocityX: 0 } as never); });

/** The animated sheet: the view laid out as a modal for screen readers. */
const sheetStyle = () => StyleSheet.flatten(screen.getByTestId('bottom-sheet').props.style);

beforeEach(() => {
  jest.clearAllMocks();
  resetCapturedGestures();
  useReducedMotion.mockReturnValue(false);
});

it('renders children while visible', async () => {
  await renderOpen();
  expect(screen.getByText('sheet body')).toBeTruthy();
  expect(screen.getByTestId('bottom-sheet').props.accessibilityViewIsModal).toBe(true);
});

it('a scrim tap closes it with a tap haptic', async () => {
  const onClose = jest.fn();
  await renderOpen({ onClose });
  await pressScrim();
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
});

it('drag down past the threshold closes it, a short drag does not', async () => {
  const onClose = jest.fn();
  await renderOpen({ onClose });
  await layOut(300);
  await drag(80);
  expect(onClose).not.toHaveBeenCalled();
  await drag(100);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('a quick flick down closes it even if short', async () => {
  const onClose = jest.fn();
  await renderOpen({ onClose });
  await drag(30, 1200);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('Android back closes it', async () => {
  const onClose = jest.fn();
  await renderOpen({ onClose });
  await act(async () => screen.getByTestId('bottom-sheet-modal').props.onRequestClose());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('a non-dismissible sheet ignores scrim, drag and back', async () => {
  const onClose = jest.fn();
  await renderOpen({ onClose, dismissible: false });
  await pressScrim();
  await drag(400, 2000);
  await act(async () => screen.getByTestId('bottom-sheet-modal').props.onRequestClose());
  expect(onClose).not.toHaveBeenCalled();
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

it('calls onClosed after closing', async () => {
  const onClosed = jest.fn();
  const { rerender } = await renderOpen({ onClosed });
  expect(onClosed).not.toHaveBeenCalled();
  await act(async () => rerender(sheet({ onClosed, visible: false })));
  expect(onClosed).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('sheet body')).toBeNull();
});

it('counts as an open sheet until closed', async () => {
  const { rerender } = await renderOpen();
  expect(screen.getByTestId('open-sheets').props.children).toBe(1);
  await act(async () => rerender(sheet({ visible: false })));
  expect(screen.getByTestId('open-sheets').props.children).toBe(0);
});

it('slides when open, with no fade on the sheet itself', async () => {
  await renderOpen();
  expect(sheetStyle().transform).toEqual([{ translateY: 0 }]);
  expect(sheetStyle().opacity).toBeUndefined();
});

it('with Reduce Motion it fades instead of sliding', async () => {
  useReducedMotion.mockReturnValue(true);
  await renderOpen();
  expect(sheetStyle().transform).toEqual([{ translateY: 0 }]);
  expect(sheetStyle().opacity).toBe(1);
});

it('with dragFromHandleOnly, only the handle drags, so scrolling content keeps its scroll', async () => {
  const onClose = jest.fn();
  await renderOpen({ onClose, dragFromHandleOnly: true });
  expect(within(screen.getByTestId('sheet-handle')).queryByText('sheet body')).toBeNull();
  await layOut(300);
  await drag(200);
  expect(onClose).toHaveBeenCalledTimes(1);
});
