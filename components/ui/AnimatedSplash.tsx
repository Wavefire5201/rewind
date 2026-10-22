import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

/**
 * The app icon's dot-matrix R as [row, column], in the order the dots arrive: up the stem,
 * across the top, round the bowl, back along the middle bar, down the leg. Each dot is a day;
 * the last is today, in the streak gold.
 */
const ORDER: readonly (readonly [number, number])[] = [
  [6, 0], [5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3],
  [1, 4], [2, 4], [3, 3], [3, 2], [3, 1], [4, 2], [5, 3], [6, 4],
];
export const SPLASH_DOTS = ORDER.length;
const TODAY = ORDER.length - 1;

// The R at the size the native splash would draw its 200 dp image (92 and 70 of 1024 there).
const PITCH = 18;
const DOT = 14;

// Timeline in ms. A day's dot fades and grows in over DOT_IN, STAGGER after the one before;
// today lands last with a small overshoot. The R is drawn by BUILT, then fades over FADE.
const STAGGER = 30;
const DOT_IN = 180;
const TODAY_AT = 610;
const TODAY_IN = 280;
const BUILT = 1100;
const FADE = 250;

function clamp01(x: number): number {
  'worklet';
  return Math.min(1, Math.max(0, x));
}

function easeOutCubic(p: number): number {
  'worklet';
  return 1 - (1 - p) ** 3;
}

function easeOutBack(p: number): number {
  'worklet';
  const s = 2.2;
  const q = p - 1;
  return 1 + (s + 1) * q ** 3 + s * q ** 2;
}

function SplashDot({ index, elapsed }: { index: number; elapsed: SharedValue<number> }) {
  const [row, col] = ORDER[index];
  const isToday = index === TODAY;
  const style = useAnimatedStyle(() => {
    const t = elapsed.value;
    if (isToday) {
      const p = clamp01((t - TODAY_AT) / TODAY_IN);
      return { opacity: Math.min(1, p * 3), transform: [{ scale: Math.max(0, easeOutBack(p)) }] };
    }
    const p = easeOutCubic(clamp01((t - index * STAGGER) / DOT_IN));
    return { opacity: p, transform: [{ scale: 0.5 + 0.5 * p }] };
  });
  return (
    <Animated.View
      testID={`splash-dot-${index}`}
      style={[
        styles.dot,
        { left: col * PITCH, top: row * PITCH, backgroundColor: isToday ? Colors.streak : Colors.accent },
        style,
      ]}
    />
  );
}

/**
 * Covers the app on a cold start: the native splash is just the background, then the R draws
 * itself one day at a time and fades into the app once it's drawn and `ready` (app data
 * loaded). With Reduce Motion it starts drawn and only fades.
 */
export default function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  // ms on the splash's own clock; Reduce Motion starts at the drawn R.
  const elapsed = useSharedValue(reduceMotion ? BUILT : 0);
  const lastFrame = useSharedValue(-1);
  const fadeRequested = useSharedValue(false);
  const fadeFrom = useSharedValue(Number.POSITIVE_INFINITY);
  const done = useSharedValue(false);

  useFrameCallback(({ timestamp }) => {
    const step = lastFrame.value < 0 ? 0 : timestamp - lastFrame.value;
    lastFrame.value = timestamp;
    const t = elapsed.value + step;
    elapsed.value = t;
    if (fadeRequested.value && t >= BUILT && fadeFrom.value === Number.POSITIVE_INFINITY) {
      fadeFrom.value = t;
    }
    if (!done.value && t >= fadeFrom.value + FADE) {
      done.value = true;
      runOnJS(onDone)();
    }
  });

  useEffect(() => {
    if (ready) fadeRequested.value = true;
  }, [ready, fadeRequested]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: 1 - easeOutCubic(clamp01((elapsed.value - fadeFrom.value) / FADE)),
  }));

  return (
    <Animated.View
      testID="animated-splash"
      accessible
      accessibilityRole="image"
      accessibilityLabel="rewind"
      style={[styles.cover, coverStyle]}
    >
      <View style={styles.glyph}>
        {ORDER.map((_, i) => (
          <SplashDot key={i} index={i} elapsed={elapsed} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.bgPage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { width: 4 * PITCH + DOT, height: 6 * PITCH + DOT },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
});
