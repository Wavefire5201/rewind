import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { haptics } from '@/utils/haptics';
import { Colors, Sizes } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { formatMonthYear } from '@/utils/dates';

interface MonthHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onTitlePress?: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
}

// The arrows are drawn 36 dp; this makes them 44 dp to touch.
const NAV_SLOP = (44 - Sizes.navButton) / 2;

export default function MonthHeader({ year, month, onPrev, onNext, onTitlePress, disablePrev, disableNext }: MonthHeaderProps) {
  const { typography } = useFont();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => { haptics.tap(); onTitlePress?.(); }}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        disabled={!onTitlePress}
        accessibilityRole={onTitlePress ? 'button' : 'header'}
        accessibilityLabel={onTitlePress ? 'Choose month' : undefined}
        accessibilityValue={onTitlePress ? { text: formatMonthYear(year, month) } : undefined}
      >
        <Text style={typography.displayTitle}>{formatMonthYear(year, month)}</Text>
      </Pressable>
      <View style={styles.navRow}>
        <Pressable
          style={({ pressed }) => [styles.navButton, pressed && !disablePrev && { opacity: 0.7 }]}
          onPress={() => { if (!disablePrev) { haptics.tap(); onPrev(); } }}
          disabled={disablePrev}
          hitSlop={NAV_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !!disablePrev }}
        >
          <CaretLeft size={18} color={disablePrev ? Colors.textTertiary : Colors.textPrimary} weight="regular" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.navButton, pressed && !disableNext && { opacity: 0.7 }]}
          onPress={() => { if (!disableNext) { haptics.tap(); onNext(); } }}
          disabled={disableNext}
          hitSlop={NAV_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !!disableNext }}
        >
          <CaretRight size={18} color={disableNext ? Colors.textTertiary : Colors.textPrimary} weight="regular" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: Sizes.navButton,
    height: Sizes.navButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
