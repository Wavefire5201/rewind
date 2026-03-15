import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/constants/theme';

const TIMER_OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
];

interface TimerSelectorProps {
  selectedDuration: number;
  onSelect: (duration: number) => void;
  visible: boolean;
}

export default function TimerSelector({ selectedDuration, onSelect, visible }: TimerSelectorProps) {
  if (!visible) return null;

  return (
    <View style={styles.row}>
      {TIMER_OPTIONS.map((option) => {
        const isActive = selectedDuration === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => { Haptics.selectionAsync(); onSelect(option.value); }}
            style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
          >
            <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 0,
  },
  pillActive: {
    backgroundColor: Colors.accent,
  },
  pillInactive: {
    backgroundColor: 'transparent',
  },
  pillText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
  },
  pillTextActive: {
    color: Colors.bgPage,
  },
  pillTextInactive: {
    color: Colors.textSecondary,
  },
});
