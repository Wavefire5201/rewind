import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { Typography } from '@/constants/theme';

interface SectionLabelProps {
  children: string;
  style?: ViewStyle;
}

export default function SectionLabel({ children, style }: SectionLabelProps) {
  return <Text style={[styles.label, style]}>{children.toLowerCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...Typography.sectionLabel,
  } as any,
});
