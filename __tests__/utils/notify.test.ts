import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  notify, dismissNotice, getNotices, subscribeNotices, setScreenReaderEnabled, resetNoticesForTests,
} from '@/utils/notify';

const titles = () => getNotices().map((n) => n.title);

beforeEach(() => {
  jest.useFakeTimers();
  resetNoticesForTests();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

it('defaults to an info notice and lists it', () => {
  notify({ title: 'coming soon' });
  expect(getNotices()).toEqual([
    expect.objectContaining({ title: 'coming soon', tone: 'info', sticky: false }),
  ]);
});

it('success and info leave after 3 s, errors after 5 s', () => {
  notify({ title: 'saved', tone: 'success' });
  notify({ title: 'soon' });
  notify({ title: 'failed', tone: 'error' });
  jest.advanceTimersByTime(2999);
  expect(titles()).toEqual(['saved', 'soon', 'failed']);
  jest.advanceTimersByTime(1);
  expect(titles()).toEqual(['failed']);
  jest.advanceTimersByTime(1999);
  expect(titles()).toEqual(['failed']);
  jest.advanceTimersByTime(1);
  expect(titles()).toEqual([]);
});

it('keeps at most 3, dropping the oldest', () => {
  for (const title of ['a', 'b', 'c', 'd']) notify({ title });
  expect(titles()).toEqual(['b', 'c', 'd']);
});

it('a notice with the same key replaces the existing one', () => {
  notify({ title: 'first', key: 'save-failed', tone: 'error' });
  notify({ title: 'other', sticky: true });
  jest.advanceTimersByTime(4000);
  notify({ title: "couldn't save", key: 'save-failed', tone: 'error' });
  // Same place in the stack, new words.
  expect(titles()).toEqual(["couldn't save", 'other']);
  // Its timer restarted: 5 s from the replacement, not from the first notice.
  jest.advanceTimersByTime(4999);
  expect(titles()).toEqual(["couldn't save", 'other']);
  jest.advanceTimersByTime(1);
  expect(titles()).toEqual(['other']);
});

it('sticky, action and screen-reader notices never time out', () => {
  notify({ title: 'sticky', tone: 'error', sticky: true });
  notify({ title: 'action', tone: 'error', action: { label: 'open settings', onPress: jest.fn() } });
  setScreenReaderEnabled(true);
  notify({ title: 'read aloud', tone: 'success' });
  jest.advanceTimersByTime(60_000);
  expect(titles()).toEqual(['sticky', 'action', 'read aloud']);
  expect(getNotices().every((n) => n.sticky)).toBe(true);
});

it('plays the tone haptic once', () => {
  notify({ title: 'saved', tone: 'success' });
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
  notify({ title: 'failed', tone: 'error' });
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('error');
  notify({ title: 'soon' });
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
});

it('announces to screen readers', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  notify({ title: 'export complete', message: '484 photos saved to your photo library.', tone: 'success' });
  expect(announce).toHaveBeenCalledWith('export complete. 484 photos saved to your photo library.');
  notify({ title: 'coming soon' });
  expect(announce).toHaveBeenLastCalledWith('coming soon');
  announce.mockRestore();
});

it('subscribers hear adds and dismissals', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeNotices(listener);
  const id = notify({ title: 'saved', sticky: true });
  expect(listener).toHaveBeenCalledTimes(1);
  dismissNotice(id);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(getNotices()).toEqual([]);
  unsubscribe();
  notify({ title: 'again' });
  expect(listener).toHaveBeenCalledTimes(2);
});

it('keeps the same list object until something changes', () => {
  // useSyncExternalStore re-renders forever if the snapshot changes on every read.
  notify({ title: 'saved' });
  expect(getNotices()).toBe(getNotices());
});
