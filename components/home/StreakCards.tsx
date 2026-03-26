import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import SectionLabel from '@/components/ui/SectionLabel';
import StatCard from '@/components/ui/StatCard';
import { useStreak } from '@/hooks/useStreak';

interface StreakCardsProps {
  albumId: string;
  albumCreatedAt: string;
}

export default function StreakCards({ albumId, albumCreatedAt }: StreakCardsProps) {
  const { currentStreak, bestStreak } = useStreak(albumId, albumCreatedAt);

  return (
    <View style={styles.container}>
      <SectionLabel>your streak</SectionLabel>
      <View style={styles.row}>
        <StatCard
          value={currentStreak}
          label="days"
          valueColor={Colors.accent}
        />
        <StatCard
          value={bestStreak}
          label="best"
          valueColor={Colors.textPrimary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
