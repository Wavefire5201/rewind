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
}

export default function MonthHeader({ year, month, onPrev, onNext, onTitlePress }: MonthHeaderProps) {
  const { typography } = useFont();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => { haptics.tap(); onTitlePress?.(); }} style={({ pressed }) => [pressed && { opacity: 0.7 }]} disabled={!onTitlePress}>
        <Text style={typography.displayTitle}>{formatMonthYear(year, month)}</Text>
      </Pressable>
      <View style={styles.navRow}>
        <Pressable style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]} onPress={() => { haptics.tap(); onPrev(); }}>
          <CaretLeft size={16} color={Colors.textSecondary} weight="light" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]} onPress={() => { haptics.tap(); onNext(); }}>
          <CaretRight size={16} color={Colors.textSecondary} weight="light" />
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
