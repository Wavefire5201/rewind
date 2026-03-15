import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
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
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function LifetimeStats({ totalPhotos, currentStreak, consistency }: LifetimeStatsProps) {
  return (
    <View>
      <SectionLabel>stats</SectionLabel>
      <View style={styles.wrapper}>
        <StatItem value={totalPhotos} label="photos" />
        <StatItem value={currentStreak} label="day streak" />
        <StatItem value={`${consistency}%`} label="consistency" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  statLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
