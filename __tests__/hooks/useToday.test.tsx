import { AppState, type AppStateStatus } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useToday } from '@/hooks/useToday';

let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementationOnce((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it('moves to the next day at local midnight while the app stays open', async () => {
  jest.setSystemTime(new Date(2026, 2, 9, 23, 58));
  const { result } = await renderHook(() => useToday());
  expect(result.current).toBe('2026-03-09');
  await act(async () => {
    jest.advanceTimersByTime(3 * 60 * 1000);
  });
  expect(result.current).toBe('2026-03-10');
});

it('catches up when the app comes back to the foreground on a later day', async () => {
  jest.setSystemTime(new Date(2026, 2, 9, 22, 0));
  const { result } = await renderHook(() => useToday());
  // Backgrounded overnight: timers may not have run, but the clock moved on.
  jest.setSystemTime(new Date(2026, 2, 11, 7, 0));
  await act(async () => appStateListener?.('active'));
  expect(result.current).toBe('2026-03-11');
});
