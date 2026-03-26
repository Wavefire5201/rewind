import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import SectionLabel from '@/components/ui/SectionLabel';

interface LifetimeStatsProps {
  totalPhotos: number;
  currentStreak: number;
  consistency: number;
}

interface StatItemProps {
  value: string | number;
  label: string;
}

function StatItem({ value, label }: StatItemProps) {
  const { fonts, typography } = useFont();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { fontFamily: fonts.light }]}>{value}</Text>
      <Text style={typography.small}>{label}</Text>
    </View>
  );
}

export default function LifetimeStats({ totalPhotos, currentStreak, consistency }: LifetimeStatsProps) {
  const { fonts } = useFont();
  return (
    <View>
      <SectionLabel>stats</SectionLabel>
      <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>across all albums</Text>
      <View style={styles.wrapper}>
        <StatItem value={totalPhotos} label="photos" />
        <StatItem value={currentStreak} label="day streak" />
        <StatItem value={`${consistency}%`} label="consistency" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  wrapper: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: Fonts.mono.light,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -1,
    color: Colors.textPrimary,
  },
});
