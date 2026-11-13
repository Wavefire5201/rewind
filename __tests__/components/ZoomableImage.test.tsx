import React from 'react';
import { render } from '@testing-library/react-native';
import ZoomableImage from '@/components/ui/ZoomableImage';
import { flushUiWrites } from '../helpers/reanimatedMock';

jest.mock('@/components/ui/PhotoImage', () => () => null);

// A gesture builder that records its handlers, so a test can drive them.
type Handlers = Record<string, (...args: unknown[]) => void>;
const mockGestures: { type: string; calls: Record<string, unknown[]>; handlers: Handlers }[] = [];
jest.mock('react-native-gesture-handler', () => {
  const builder = (type: string) => () => {
    const g = { type, calls: {} as Record<string, unknown[]>, handlers: {} as Handlers };
    mockGestures.push(g);
    const proxy: object = new Proxy({}, {
      get: (_t, prop: string) => (...args: unknown[]) => {
        g.calls[prop] = args;
        if (typeof args[0] === 'function') g.handlers[prop] = args[0] as (...a: unknown[]) => void;
        return proxy;
      },
    });
    return proxy;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: builder('pan'), Pinch: builder('pinch'), Tap: builder('tap'), Simultaneous: () => ({}) },
  };
});

const latest = (type: string) => mockGestures.filter((g) => g.type === type).at(-1)!;
const touch = () => {
  const state = { activate: jest.fn(), fail: jest.fn() };
  latest('pan').handlers.onTouchesMove({}, state);
  return state;
};

beforeEach(() => { mockGestures.length = 0; });

it("leaves a horizontal drag to the day pager until the photo is zoomed", async () => {
  await render(<ZoomableImage uri="file:///a.jpg" width={360} height={480} />);
  expect(latest('pan').calls.manualActivation).toEqual([true]);
  const state = touch();
  expect(state.fail).toHaveBeenCalled();
  expect(state.activate).not.toHaveBeenCalled();
});

it('pans the photo once it is zoomed in', async () => {
  await render(<ZoomableImage uri="file:///a.jpg" width={360} height={480} />);
  // Gesture callbacks write shared values from the UI thread; flush them between frames.
  latest('pinch').handlers.onUpdate({ scale: 2 });
  flushUiWrites();
  latest('pinch').handlers.onEnd({});
  flushUiWrites();
  const state = touch();
  expect(state.activate).toHaveBeenCalled();
  expect(state.fail).not.toHaveBeenCalled();
});
