import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BellSimple } from 'phosphor-react-native';
import { Colors, Typography, Sizes } from '@/constants/theme';
import CircleButton from '@/components/ui/CircleButton';
import { useGreeting } from '@/hooks/useGreeting';

export default function HomeHeader() {
  const { greeting, dayNumber } = useGreeting();

  return (
    <View style={styles.row}>
      <View style={styles.textGroup}>
        <Text style={Typography.small}>{greeting}</Text>
        <Text style={Typography.displayTitle}>day {dayNumber}</Text>
      </View>
      <CircleButton onPress={() => {}} size={Sizes.notifButton}>
        <BellSimple size={18} color={Colors.textSecondary} weight="light" />
      </CircleButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textGroup: {
    gap: 2,
  },
});
