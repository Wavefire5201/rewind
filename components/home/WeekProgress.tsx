import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Sizes } from '@/constants/theme';
import SectionLabel from '@/components/ui/SectionLabel';
import { useStreak } from '@/hooks/useStreak';
import type { WeekDay } from '@/types';

function DayColumn({ day }: { day: WeekDay }) {
  if (day.status === 'disabled') {
    return <View style={styles.dayColumn} />;
  }

  const isCaptured = day.status === 'captured' || day.status === 'today-done';
  const isTodayPending = day.status === 'today-pending';

  return (
    <View style={styles.dayColumn}>
      <Text style={styles.dayLabel}>{day.dayLabel}</Text>
      {isCaptured ? (
        <View style={[styles.dot, styles.dotFilled]} />
      ) : (
        <View
          style={[
            styles.dot,
            isTodayPending ? styles.dotTodayPending : styles.dotDefault,
          ]}
        />
      )}
    </View>
  );
}

export default function WeekProgress() {
  const { weekStatus } = useStreak();

  return (
    <View style={styles.container}>
      <SectionLabel>this week</SectionLabel>
      <View style={styles.row}>
        {weekStatus.map((day, index) => (
          <DayColumn key={day.date ?? index} day={day} />
        ))}
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
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dayLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  dot: {
    width: Sizes.weekDot,
    height: Sizes.weekDot,
    borderRadius: Sizes.weekDot / 2,
  },
  dotFilled: {
    backgroundColor: Colors.accent,
  },
  dotTodayPending: {
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
  },
  dotDefault: {
    backgroundColor: Colors.bgSurface,
  },
});
