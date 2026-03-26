import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography } from '@/constants/theme';

interface StatCardProps {
  value: string | number;
  label: string;
  valueColor?: string;
  size?: 'large' | 'medium';
  style?: ViewStyle;
}

export default function StatCard({ value, label, valueColor = Colors.textPrimary, size = 'large', style }: StatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={[size === 'large' ? Typography.bigNumber : Typography.mediumNumber, { color: valueColor }]}>
        {value}
      </Text>
      <Text style={[Typography.small, { color: Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    flex: 1,
    alignItems: 'center',
  },
});
