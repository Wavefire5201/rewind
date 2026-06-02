import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { haptics } from '@/utils/haptics';
import { Colors, Sizes } from '@/constants/theme';

interface ShutterButtonProps {
  onPress: () => void;
  onLongPress?: () => void;
  autoCaptureProgress?: number;
  isInCooldown?: boolean;
  hasAlignmentTarget?: boolean;
  disabled?: boolean;
}

export default function ShutterButton({ onPress, onLongPress, autoCaptureProgress = 0, isInCooldown = false, hasAlignmentTarget, disabled = false }: ShutterButtonProps) {
  return (
    <Pressable
      onPress={() => {
        if (!isInCooldown && !disabled) {
          haptics.shutter();
          onPress();
        }
      }}
      onLongPress={() => {
        if (!isInCooldown && !disabled && onLongPress) {
          onLongPress();
        }
      }}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.outer,
        pressed && !isInCooldown && !disabled && { transform: [{ scale: 0.95 }] },
        isInCooldown && { opacity: 0.4 },
        disabled && { opacity: 0.35 },
        autoCaptureProgress > 0 && !isInCooldown && !disabled && {
          borderColor: Colors.streak,
        },
      ]}
    >
      <View style={[
        styles.inner,
        autoCaptureProgress > 0 && !isInCooldown && !disabled && {
          backgroundColor: Colors.streak,
          transform: [{ scale: 0.85 + autoCaptureProgress * 0.15 }],
        },
      ]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: Sizes.shutterOuter,
    height: Sizes.shutterOuter,
    borderRadius: Sizes.shutterOuter / 2,
    borderWidth: 3,
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: Sizes.shutterInner,
    height: Sizes.shutterInner,
    borderRadius: Sizes.shutterInner / 2,
    backgroundColor: Colors.accent,
  },
});
