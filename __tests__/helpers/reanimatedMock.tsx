/** Reanimated stand-in with the device's threading semantics where they matter:
 *  - a JS write to a shared value lands on the UI copy only when the UI thread next runs
 *    (a frame-callback tick or a render of an animated style);
 *  - a JS read returns the UI copy (so read-modify-write from JS can lose updates);
 *  - writes made inside a frame callback (the UI thread) apply immediately.
 *  Frame callbacks are captured so tests can tick the UI-thread clock. */
import React from 'react';
import { View, FlatList } from 'react-native';

export type FrameInfo = { timestamp: number };
export type TestClock = { tick: (info: FrameInfo) => void; active: boolean; setActive: (active: boolean) => void };
export const frameClocks: TestClock[] = [];

let pendingUiWrites: (() => void)[] = [];
let onUiThread = false;

/** Apply queued JS -> UI writes, as the UI thread does before its next frame. */
export function flushUiWrites(): void {
  const writes = pendingUiWrites;
  pendingUiWrites = [];
  writes.forEach((write) => write());
}

function makeShared<T>(initial: T) {
  let ui = initial;
  return {
    get value() {
      return ui;
    },
    set value(next: T) {
      if (onUiThread) ui = next;
      else pendingUiWrites.push(() => { ui = next; });
    },
  };
}

/** Layout-animation builders (FadeIn, SlideInUp…): chainable, and tagged with their name so tests
 *  can tell a fade from a slide. */
export type AnimationBuilder = { animation: string } & Record<string, unknown>;
function builder(animation: string): AnimationBuilder {
  const b: AnimationBuilder = new Proxy({ animation } as AnimationBuilder, {
    get: (target, prop) => (prop in target ? target[prop as string] : prop === 'then' ? undefined : () => b),
  });
  return b;
}
const layoutAnimations = Object.fromEntries(
  ['FadeIn', 'FadeOut', 'FadeInUp', 'FadeOutUp', 'SlideInUp', 'SlideOutUp', 'SlideInDown', 'SlideOutDown', 'SlideOutLeft', 'SlideOutRight', 'LinearTransition']
    .map((name) => [name, builder(name)]),
);

export const reanimatedMock = {
  __esModule: true,
  ...layoutAnimations,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  /** Animations finish at once: the value jumps to its target and the callback reports finished. */
  withTiming<T>(to: T, _config?: unknown, callback?: (finished: boolean) => void): T {
    callback?.(true);
    return to;
  },
  withSpring<T>(to: T, _config?: unknown, callback?: (finished: boolean) => void): T {
    callback?.(true);
    return to;
  },
  withDelay<T>(_delay: number, animation: T): T {
    return animation;
  },
  cancelAnimation: jest.fn(),
  Easing: {
    bezier: () => (t: number) => t,
    linear: (t: number) => t,
    cubic: (t: number) => t,
    out: (f: unknown) => f,
    in: (f: unknown) => f,
    inOut: (f: unknown) => f,
  },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate(value: number, input: number[], output: number[]): number {
    // Linear between the first two stops, clamped: enough for opacity/translate mappings.
    const [i0, i1] = input;
    const [o0, o1] = output;
    const t = Math.min(1, Math.max(0, (value - i0) / (i1 - i0)));
    return o0 + (o1 - o0) * t;
  },
  default: { View, FlatList } as Record<string, unknown>,
  useSharedValue<T>(initial: T) {
    const ref = React.useRef<ReturnType<typeof makeShared<T>> | null>(null);
    if (!ref.current) ref.current = makeShared(initial);
    return ref.current;
  },
  useAnimatedStyle(updater: () => object) {
    flushUiWrites();
    return updater();
  },
  useAnimatedProps(updater: () => object) {
    flushUiWrites();
    return updater();
  },
  useDerivedValue<T>(compute: () => T) {
    flushUiWrites();
    return { value: compute() };
  },
  /** Runs the reaction at render with the current value (the UI thread would run it on change). */
  useAnimatedReaction<T>(prepare: () => T, react: (current: T, previous: T | null) => void) {
    flushUiWrites();
    react(prepare(), null);
  },
  useAnimatedRef<T>() {
    return React.useRef<T | null>(null);
  },
  scrollTo: jest.fn(),
  /** The keyboard's height and state; tests set a height with mockReturnValue. */
  useAnimatedKeyboard: jest.fn(() => ({ height: { value: 0 }, state: { value: 0 } })),
  KeyboardState: { UNKNOWN: 0, OPENING: 1, OPEN: 2, CLOSING: 3, CLOSED: 4 },
  /** The system Reduce Motion setting; tests flip it with mockReturnValue(true). */
  useReducedMotion: jest.fn(() => false),
  // UI → JS calls run inline: the mock has no separate UI runtime.
  runOnJS: <A extends unknown[]>(fn: (...args: A) => void) => fn,
  createAnimatedComponent<P extends object>(Component: React.ComponentType<P>) {
    // Animated props arrive via `animatedProps`; merge them so tests can read them.
    return (props: P & { animatedProps?: object }) => {
      const { animatedProps, ...rest } = props;
      return React.createElement(Component, { ...(rest as P), ...(animatedProps ?? {}) });
    };
  },
  useFrameCallback(callback: (info: FrameInfo) => void) {
    const ref = React.useRef<TestClock | null>(null);
    const latest = React.useRef(callback);
    latest.current = callback;
    if (!ref.current) {
      const clock: TestClock = {
        tick: (info) => {
          flushUiWrites();
          onUiThread = true;
          try { latest.current(info); } finally { onUiThread = false; }
        },
        active: false,
        setActive: (active: boolean) => { clock.active = active; },
      };
      ref.current = clock;
      frameClocks.push(clock);
    }
    return ref.current;
  },
};

reanimatedMock.default.createAnimatedComponent = reanimatedMock.createAnimatedComponent;
