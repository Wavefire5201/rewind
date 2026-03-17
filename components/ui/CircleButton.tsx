import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/theme';

interface CircleButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
}

export default function CircleButton({ children, onPress, size = 48, style }: CircleButtonProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
