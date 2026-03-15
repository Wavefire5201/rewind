import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes } from '@/constants/theme';

interface ShutterButtonProps {
  onPress: () => void;
}

export default function ShutterButton({ onPress }: ShutterButtonProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.outer,
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      <View style={styles.inner} />
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
