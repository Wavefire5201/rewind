import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { haptics } from '@/utils/haptics';
import { Colors, Typography, Sizes } from '@/constants/theme';
import { formatMonthYear } from '@/utils/dates';

interface MonthHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onTitlePress?: () => void;
}

export default function MonthHeader({ year, month, onPrev, onNext, onTitlePress }: MonthHeaderProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => { haptics.tap(); onTitlePress?.(); }} activeOpacity={0.7} disabled={!onTitlePress}>
        <Text style={Typography.displayTitle}>{formatMonthYear(year, month)}</Text>
      </TouchableOpacity>
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => { haptics.tap(); onPrev(); }} activeOpacity={0.7}>
          <CaretLeft size={16} color={Colors.textSecondary} weight="light" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => { haptics.tap(); onNext(); }} activeOpacity={0.7}>
          <CaretRight size={16} color={Colors.textSecondary} weight="light" />
        </TouchableOpacity>
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
