import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { haptics } from '@/utils/haptics';
import { Colors, BorderRadius, Fonts, Pressed } from '@/constants/theme';

type Size = 'small' | 'medium' | 'large';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined';
  /** small: inline (capture preview), medium: sheets and prompts, large: full-width primary actions. */
  size?: Size;
  icon?: React.ReactNode;
  style?: ViewStyle;
  /** Taps on press; pass false when the action gives its own feedback (e.g. a success buzz). */
  haptic?: boolean;
  accessibilityLabel?: string;
}

/** The app's button: every filled or outlined button looks and responds the same. */
export default function PillButton({
  label,
  onPress,
  variant = 'filled',
  size = 'small',
  icon,
  style,
  haptic = true,
  accessibilityLabel,
}: PillButtonProps) {
  const isFilled = variant === 'filled';

  return (
    <Pressable
      onPress={() => {
        if (haptic) haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        sizeStyles[size],
        isFilled ? styles.filled : styles.outlined,
        pressed && { opacity: Pressed.filled },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {icon}
      <Text
        style={[
          styles.label,
          labelStyles[size],
          { color: isFilled ? Colors.bgPage : Colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const sizeStyles = StyleSheet.create({
  small: { paddingVertical: 10, paddingHorizontal: 20 },
  medium: { paddingVertical: 12, paddingHorizontal: 24 },
  large: { paddingVertical: 16, paddingHorizontal: 24 },
});

const labelStyles = StyleSheet.create({
  small: { fontFamily: Fonts.mono.regular, fontSize: 13 },
  medium: { fontFamily: Fonts.mono.medium, fontSize: 13 },
  large: { fontFamily: Fonts.mono.medium, fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.none,
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
  },
});
