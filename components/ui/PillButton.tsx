import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { haptics } from '@/utils/haptics';
import { Colors, BorderRadius, Fonts } from '@/constants/theme';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function PillButton({ label, onPress, variant = 'filled', icon, style }: PillButtonProps) {
  const isFilled = variant === 'filled';

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        isFilled ? styles.filled : styles.outlined,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: isFilled ? Colors.bgPage : Colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.none,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 8,
  },
  filled: {
    backgroundColor: Colors.accent,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  label: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
  },
});
