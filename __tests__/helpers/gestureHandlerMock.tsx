/** react-native-gesture-handler stand-in that records every gesture a component builds, so tests
 *  can drive its callbacks directly:
 *
 *    jest.mock('react-native-gesture-handler', () => require('../helpers/gestureHandlerMock').gestureHandlerMock);
 *    lastGesture('Pan').handlers.onEnd({ translationX: 120, velocityX: 0 });
 *
 *  Handlers are the `on…` callbacks (onStart, onUpdate, onEnd…); other builder calls (activeOffsetX,
 *  enabled…) are kept as config. */
import { View } from 'react-native';

type Handler = (...args: never[]) => unknown;
export type CapturedGesture = {
  type: string;
  handlers: Record<string, Handler>;
  config: Record<string, unknown[]>;
};

export const capturedGestures: CapturedGesture[] = [];

function makeGesture(type: string): unknown {
  const captured: CapturedGesture = { type, handlers: {}, config: {} };
  capturedGestures.push(captured);
  const gesture: unknown = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;
      return (...args: unknown[]) => {
        const name = String(prop);
        if (/^on[A-Z]/.test(name) && typeof args[0] === 'function') captured.handlers[name] = args[0] as Handler;
        else captured.config[name] = args;
        return gesture;
      };
    },
  });
  return gesture;
}

/** The most recently built gesture of a type. */
export function lastGesture(type = 'Pan'): CapturedGesture {
  const found = [...capturedGestures].reverse().find((g) => g.type === type);
  if (!found) throw new Error(`no ${type} gesture was built`);
  return found;
}

export function resetCapturedGestures(): void {
  capturedGestures.length = 0;
}

export const gestureHandlerMock = {
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  GestureHandlerRootView: View,
  Gesture: {
    Pan: () => makeGesture('Pan'),
    Tap: () => makeGesture('Tap'),
    Pinch: () => makeGesture('Pinch'),
    Simultaneous: () => makeGesture('Simultaneous'),
    Exclusive: () => makeGesture('Exclusive'),
    Race: () => makeGesture('Race'),
  },
};
