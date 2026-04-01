import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

export interface FaceGuideProps {
  faceX: SharedValue<number>;
  faceY: SharedValue<number>;
  faceWidth: SharedValue<number>;
  faceHeight: SharedValue<number>;
  hasFace: SharedValue<boolean>;
  alignmentScore?: SharedValue<number>;
}

export default function FaceGuide({
  faceX,
  faceY,
  faceWidth,
  faceHeight,
  hasFace,
  alignmentScore,
}: FaceGuideProps) {
  const { width, height } = useWindowDimensions();

  const defaultOvalWidth = Math.round(width * 0.57);
  const defaultOvalHeight = Math.round(defaultOvalWidth / 0.75);
  const defaultLeft = (width - defaultOvalWidth) / 2;
  const defaultTop = (height - defaultOvalHeight) / 2;

  const crosshairSize = 12;

  const containerStyle = useAnimatedStyle(() => {
    const timing = { duration: 100 };
    if (hasFace.value) {
      return {
        position: 'absolute' as const,
        left: withTiming(faceX.value, timing),
        top: withTiming(faceY.value, timing),
        width: withTiming(faceWidth.value, timing),
        height: withTiming(faceHeight.value, timing),
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
    const currentWidth = hasFace.value ? faceWidth.value : defaultOvalWidth;
    return {
      borderColor,
      borderRadius: currentWidth / 2,
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill]} pointerEvents="none">
      <Animated.View style={[styles.ovalContainer, containerStyle]}>
        <Animated.View style={[styles.oval, ovalStyle]}>
          {/* Horizontal crosshair */}
          <Animated.View style={[styles.crosshairH, { width: crosshairSize }]} />
          {/* Vertical crosshair */}
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
