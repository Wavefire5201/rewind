import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { Typography } from '@/constants/theme';
import { useFont } from '@/context/FontContext';

interface SectionLabelProps {
  children: string;
  style?: TextStyle;
}

export default function SectionLabel({ children, style }: SectionLabelProps) {
  const { fonts } = useFont();
  return <Text style={[styles.label, { fontFamily: fonts.regular }, style]}>{children.toLowerCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...Typography.sectionLabel,
  },
});
