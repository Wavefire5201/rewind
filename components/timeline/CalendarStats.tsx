import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';

interface CalendarStatsProps {
  captured: number;
  missed: number;
}

export default function CalendarStats({ captured, missed }: CalendarStatsProps) {
  const { fonts } = useFont();
  return (
    <View style={styles.row}>
      <View style={styles.stat}>
        <View style={styles.dotWhite} />
        <Text style={[styles.label, { fontFamily: fonts.regular }]}>{captured} captured</Text>
      </View>
      <View style={styles.stat}>
        <View style={styles.dotGray} />
        <Text style={[styles.label, { fontFamily: fonts.regular }]}>{missed} missed</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotWhite: {
    width: 8,
    height: 8,
    borderRadius: 0,
    backgroundColor: Colors.textPrimary,
  },
  dotGray: {
    width: 8,
    height: 8,
    borderRadius: 0,
    backgroundColor: Colors.textTertiary,
  },
  label: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textTertiary,
  },
});
