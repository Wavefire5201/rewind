import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import NoticeLayer from '@/components/ui/overlay/NoticeLayer';
import { notify, getNotices, resetNoticesForTests } from '@/utils/notify';
import { lastGesture, resetCapturedGestures } from '../../helpers/gestureHandlerMock';

jest.mock('react-native-reanimated', () => require('../../helpers/reanimatedMock').reanimatedMock);
jest.mock('react-native-gesture-handler', () => require('../../helpers/gestureHandlerMock').gestureHandlerMock);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const { useReducedMotion } = jest.requireMock('react-native-reanimated') as { useReducedMotion: jest.Mock };
const inFonts = (ui: React.ReactElement) => render(<FontProvider>{ui}</FontProvider>);

beforeEach(() => {
  resetNoticesForTests();
  resetCapturedGestures();
  useReducedMotion.mockReturnValue(false);
  jest.clearAllMocks();
});

// Clears the store's auto-dismiss timers, so none outlive the test file.
afterEach(() => resetNoticesForTests());

it('only the most recently mounted layer renders notices', async () => {
  const { rerender } = await inFonts(<><NoticeLayer testID="a" /><NoticeLayer testID="b" /></>);
  await act(async () => { notify({ title: 'saved' }); });
  expect(screen.getAllByText('saved')).toHaveLength(1);
  expect(within(screen.getByTestId('b')).getByText('saved')).toBeTruthy();

  // The modal holding layer b closes: the notice moves to the layer underneath.
  await act(async () => rerender(<FontProvider><NoticeLayer testID="a" /></FontProvider>));
  expect(within(screen.getByTestId('a')).getByText('saved')).toBeTruthy();
});

it('a swipe dismisses a notice', async () => {
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'export complete', tone: 'success' }); });
  await act(async () => { lastGesture('Pan').handlers.onEnd({ translationX: 120, translationY: 0, velocityX: 0, velocityY: 0 } as never); });
  expect(getNotices()).toEqual([]);
});

it('a short drag does not dismiss it', async () => {
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'export complete', tone: 'success' }); });
  await act(async () => { lastGesture('Pan').handlers.onEnd({ translationX: 20, translationY: 10, velocityX: 0, velocityY: 0 } as never); });
  expect(getNotices()).toHaveLength(1);
});

it('a swipe up dismisses it too', async () => {
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'export complete', tone: 'success' }); });
  await act(async () => { lastGesture('Pan').handlers.onEnd({ translationX: 0, translationY: -20, velocityX: 0, velocityY: -900 } as never); });
  expect(getNotices()).toEqual([]);
});

it('an action button runs and dismisses', async () => {
  const onPress = jest.fn();
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'notifications are off', tone: 'error', action: { label: 'open settings', onPress } }); });
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'open settings' })));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(getNotices()).toEqual([]);
});

it('sticky notices show no countdown bar', async () => {
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: "couldn't load your photos", tone: 'error', sticky: true }); });
  expect(screen.queryByTestId('notice-countdown')).toBeNull();
  await act(async () => { notify({ title: 'export complete', tone: 'success' }); });
  expect(screen.getAllByTestId('notice-countdown')).toHaveLength(1);
});

it('is an alert a screen reader can dismiss', async () => {
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'export failed', tone: 'error' }); });
  const card = screen.getByRole('alert');
  await act(async () => card.props.onAccessibilityAction({ nativeEvent: { actionName: 'escape' } }));
  expect(getNotices()).toEqual([]);
});

it('slides in from the top and out the top', async () => {
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'saved' }); });
  const card = screen.getByTestId('notice-card');
  expect(card.props.entering.animation).toBe('FadeInUp');
  expect(card.props.exiting.animation).toBe('FadeOutUp');
});

it('with Reduce Motion the notice only fades', async () => {
  useReducedMotion.mockReturnValue(true);
  await inFonts(<NoticeLayer />);
  await act(async () => { notify({ title: 'saved' }); });
  const card = screen.getByTestId('notice-card');
  expect(card.props.entering.animation).toBe('FadeIn');
  expect(card.props.exiting.animation).toBe('FadeOut');
});
