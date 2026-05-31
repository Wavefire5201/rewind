import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Backspace } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

interface PinEntryProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onCancel: () => void;
  error?: string;
  resetKey?: number;
  /** When true, digit keys and backspace are non-interactive (e.g. during lockout). */
  disableKeypad?: boolean;
  /** Override the label on the cancel button (default: "cancel"). */
  cancelLabel?: string;
}

export default function PinEntry({ title, subtitle, onComplete, onCancel, error, resetKey, disableKeypad, cancelLabel }: PinEntryProps) {
  const { fonts } = useFont();
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, [resetKey]);

  const handleDigit = useCallback((digit: string) => {
    if (disableKeypad) return;
    haptics.tap();
    setPin(prev => {
      const next = prev + digit;
      if (next.length === 4) {
        setTimeout(() => onComplete(next), 150);
      }
      return next.length <= 4 ? next : prev;
    });
  }, [onComplete, disableKeypad]);

  const handleBackspace = useCallback(() => {
    if (disableKeypad) return;
    haptics.tap();
    setPin(prev => prev.slice(0, -1));
  }, [disableKeypad]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={[styles.title, { fontFamily: fonts.light }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>{subtitle}</Text>}
        {error && <Text style={[styles.error, { fontFamily: fonts.regular }]}>{error}</Text>}

        {/* Dots */}
        <View style={styles.dots}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length && styles.dotFilled,
                error ? styles.dotError : null,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Number pad */}
      <View style={[styles.pad, disableKeypad && { opacity: 0.3 }]}>
        {digits.map((d, i) => {
          if (d === '') {
            return <View key={i} style={styles.padBtn} />;
          }
          if (d === 'back') {
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.padBtn, pressed && !disableKeypad && { opacity: 0.5 }]}
                onPress={handleBackspace}
                accessibilityLabel="Delete"
                accessibilityRole="button"
              >
                <Backspace size={24} color={Colors.textPrimary} weight="light" />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.padBtn, pressed && !disableKeypad && { opacity: 0.5 }]}
              onPress={() => handleDigit(d)}
              accessibilityLabel={d}
              accessibilityRole="button"
            >
              <Text style={[styles.padDigit, { fontFamily: fonts.light }]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Cancel / action */}
      <Pressable
        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        onPress={onCancel}
        accessibilityLabel={cancelLabel ?? 'Cancel'}
        accessibilityRole="button"
      >
        <Text style={[styles.cancelText, { fontFamily: fonts.regular }]}>{cancelLabel ?? 'cancel'}</Text>
      </Pressable>
    </View>
  );
}

const DOT_SIZE = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
    justifyContent: 'space-between',
    paddingTop: 32,
    paddingBottom: 40,
  },
  top: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontFamily: Fonts.mono.light,
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  error: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.danger,
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  dotError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  padBtn: {
    width: '33.33%',
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padDigit: {
    fontFamily: Fonts.mono.light,
    fontSize: 32,
    color: Colors.textPrimary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
