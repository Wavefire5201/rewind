import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import { Stack } from 'phosphor-react-native';
import Slider from '@/components/ui/OpacitySlider';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import type { FaceLandmarks } from '@/types';

/** Live eye landmarks (screen-aligned, normalized 0-1) driven by the frame processor. */
export interface GhostLiveValues {
  leftEyeX: SharedValue<number>;
  leftEyeY: SharedValue<number>;
  rightEyeX: SharedValue<number>;
  rightEyeY: SharedValue<number>;
  hasFace: SharedValue<boolean>;
}

interface GhostOverlayProps {
  imageUri: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
  ghostLandmarks?: FaceLandmarks | null;
  currentIsMirrored?: boolean;
  liveValues?: GhostLiveValues | null;
  containerWidth?: number;
  containerHeight?: number;
}

export default function GhostOverlay({
  imageUri,
  opacity,
  onOpacityChange,
  ghostLandmarks,
  currentIsMirrored,
  liveValues,
  containerWidth = 0,
  containerHeight = 0,
}: GhostOverlayProps) {
  const { fonts } = useFont();

  const aligned = !!(ghostLandmarks && liveValues && containerWidth > 0 && containerHeight > 0);

  const needFlip = !!(ghostLandmarks && currentIsMirrored !== undefined && ghostLandmarks.isMirrored !== currentIsMirrored);

  const gLeftXn = needFlip ? 1 - (ghostLandmarks?.leftEye.x ?? 0) : (ghostLandmarks?.leftEye.x ?? 0);
  const gLeftYn = needFlip ? 1 - (ghostLandmarks?.leftEye.y ?? 0) : (ghostLandmarks?.leftEye.y ?? 0);
  const gRightXn = needFlip ? 1 - (ghostLandmarks?.rightEye.x ?? 0) : (ghostLandmarks?.rightEye.x ?? 0);
  const gRightYn = needFlip ? 1 - (ghostLandmarks?.rightEye.y ?? 0) : (ghostLandmarks?.rightEye.y ?? 0);

  const alignStyle = useAnimatedStyle(() => {
    'worklet';
    if (!aligned || !liveValues!.hasFace.value) {
      return {
        transform: [
          { translateX: withTiming(0, { duration: 300 }) },
          { translateY: withTiming(0, { duration: 300 }) },
          { scale: withTiming(1, { duration: 300 }) },
        ],
      };
    }
    const W = containerWidth;
    const H = containerHeight;

    const gLeftX = gLeftXn * W;
    const gLeftY = gLeftYn * H;
    const gRightX = gRightXn * W;
    const gRightY = gRightYn * H;
    const lLeftX = liveValues!.leftEyeX.value * W;
    const lLeftY = liveValues!.leftEyeY.value * H;
    const lRightX = liveValues!.rightEyeX.value * W;
    const lRightY = liveValues!.rightEyeY.value * H;

    const gIPD = Math.sqrt((gRightX - gLeftX) ** 2 + (gRightY - gLeftY) ** 2);
    const lIPD = Math.sqrt((lRightX - lLeftX) ** 2 + (lRightY - lLeftY) ** 2);
    if (gIPD <= 0 || lIPD <= 0) {
      return {
        transform: [
          { translateX: withTiming(0, { duration: 300 }) },
          { translateY: withTiming(0, { duration: 300 }) },
          { scale: withTiming(1, { duration: 300 }) },
        ],
      };
    }

    let scale = lIPD / gIPD;
    scale = Math.max(0.2, Math.min(5, scale));

    const gMidX = (gLeftX + gRightX) / 2;
    const gMidY = (gLeftY + gRightY) / 2;
    const lMidX = (lLeftX + lRightX) / 2;
    const lMidY = (lLeftY + lRightY) / 2;

    const cX = W / 2;
    const cY = H / 2;
    const tx = lMidX - scale * gMidX + (scale - 1) * cX;
    const ty = lMidY - scale * gMidY + (scale - 1) * cY;

    return {
      transform: [
        { translateX: withTiming(tx, { duration: 150 }) },
        { translateY: withTiming(ty, { duration: 150 }) },
        { scale: withTiming(scale, { duration: 150 }) },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, alignStyle]} pointerEvents="none">
        <Image
          source={{ uri: imageUri }}
          style={[StyleSheet.absoluteFill, { opacity }]}
          // When aligning, render in the same anisotropic norm*W/norm*H space the
          // transform math (and FaceGuide/FaceDebugOverlay) assume, so the ghost
          // eyes land where the math puts them. Static fallback keeps aspect (cover).
          contentFit={aligned ? 'fill' : 'cover'}
        />
      </Animated.View>
      <View style={styles.controls} pointerEvents="box-none">
        <View style={styles.badge}>
          <Stack size={12} color={Colors.textPrimary} weight="light" />
          <Text style={[styles.badgeText, { fontFamily: fonts.regular }]}>{Math.round(opacity * 100)}%</Text>
        </View>
        <View style={styles.sliderWrap}>
          <Slider value={opacity} onValueChange={onOpacityChange} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgPageTranslucent,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textPrimary,
  },
  sliderWrap: {
    flex: 1,
    maxWidth: 120,
  },
});
