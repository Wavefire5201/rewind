import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming, interpolateColor } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Colors } from '@/constants/theme';

export interface FaceGuideProps {
  faceX: SharedValue<number>;
  faceY: SharedValue<number>;
  faceWidth: SharedValue<number>;
  faceHeight: SharedValue<number>;
  hasFace: SharedValue<boolean>;
  alignmentScore?: SharedValue<number>;
  containerWidth: number;
  containerHeight: number;
  contourData?: SharedValue<number[]>;
}

export default function FaceGuide({
  faceX,
  faceY,
  faceWidth,
  faceHeight,
  hasFace,
  alignmentScore,
  containerWidth,
  containerHeight,
  contourData,
}: FaceGuideProps) {
  const width = containerWidth || 1;
  const height = containerHeight || 1;

  const defaultOvalWidth = Math.round(width * 0.57);
  const defaultOvalHeight = Math.round(defaultOvalWidth / 0.75);
  const defaultLeft = (width - defaultOvalWidth) / 2;
  const defaultTop = (height - defaultOvalHeight) / 2;

  const crosshairSize = 12;

  // Skia path derived from contour shared value — runs on UI thread, no React re-renders
  const contourPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const pts = contourData?.value;
    if (!pts || pts.length < 6 || !hasFace.value) return p;

    // Catmull-Rom to cubic bezier for smooth curves
    const count = pts.length / 2;
    const px = (i: number) => pts[((i % count) + count) % count * 2] * width;
    const py = (i: number) => pts[((i % count) + count) % count * 2 + 1] * height;

    p.moveTo(px(0), py(0));
    for (let i = 0; i < count; i++) {
      const cp1x = px(i) + (px(i + 1) - px(i - 1)) / 6;
      const cp1y = py(i) + (py(i + 1) - py(i - 1)) / 6;
      const cp2x = px(i + 1) - (px(i + 2) - px(i)) / 6;
      const cp2y = py(i + 1) - (py(i + 2) - py(i)) / 6;
      p.cubicTo(cp1x, cp1y, cp2x, cp2y, px(i + 1), py(i + 1));
    }
    p.close();
    return p;
  }, [contourData, hasFace]);

  const hasContour = contourData !== undefined;

  // Oval fallback styles
  const containerStyle = useAnimatedStyle(() => {
    const timing = { duration: 100 };
    if (hasFace.value) {
      return {
        position: 'absolute' as const,
        left: withTiming(faceX.value * width, timing),
        top: withTiming(faceY.value * height, timing),
        width: withTiming(faceWidth.value * width, timing),
        height: withTiming(faceHeight.value * height, timing),
      };
    }
    return {
      position: 'absolute' as const,
      left: withTiming(defaultLeft, timing),
      top: withTiming(defaultTop, timing),
      width: withTiming(defaultOvalWidth, timing),
      height: withTiming(defaultOvalHeight, timing),
    };
  });

  const ovalStyle = useAnimatedStyle(() => {
    const score = alignmentScore ? alignmentScore.value : 0;
    const borderColor = interpolateColor(
      score,
      [0, 1],
      [Colors.textTertiary, Colors.accent],
    );
    const currentWidth = hasFace.value ? faceWidth.value * width : defaultOvalWidth;
    return {
      borderColor,
      borderRadius: currentWidth / 2,
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill]} pointerEvents="none">
      {/* Skia contour — GPU-rendered, no React re-renders */}
      {hasContour ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path
            path={contourPath}
            color={Colors.textTertiary}
            style="stroke"
            strokeWidth={1.5}
            opacity={0.6}
          />
        </Canvas>
      ) : null}

      {/* Oval: tracks face when detected, falls back to default position otherwise.
          When contour is available, renders behind the Skia canvas. */}
      <Animated.View style={[styles.ovalContainer, containerStyle]}>
        <Animated.View style={[styles.oval, ovalStyle]}>
          <Animated.View style={[styles.crosshairH, { width: crosshairSize }]} />
          <Animated.View style={[styles.crosshairV, { height: crosshairSize }]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ovalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  oval: {
    flex: 1,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    borderStyle: 'dashed',
    opacity: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    height: 1,
    backgroundColor: Colors.textTertiary,
    opacity: 0.5,
    position: 'absolute',
  },
  crosshairV: {
    width: 1,
    backgroundColor: Colors.textTertiary,
    opacity: 0.5,
    position: 'absolute',
  },
});
