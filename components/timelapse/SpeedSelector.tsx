import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/constants/theme';

interface SpeedSelectorProps {
  selectedSpeed: number;
  onSelect: (speed: number) => void;
}

const SPEEDS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
];

function SpeedSelector({ selectedSpeed, onSelect }: SpeedSelectorProps) {
  return (
    <View style={styles.row}>
      {SPEEDS.map(({ label, value }) => {
        const isActive = selectedSpeed === value;
        return (
          <Pressable
            key={value}
            onPress={() => { Haptics.selectionAsync(); onSelect(value); }}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.label, isActive ? styles.activeLabel : styles.inactiveLabel]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default React.memo(SpeedSelector);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
  },
  activeLabel: {
    color: Colors.textPrimary,
    fontFamily: Fonts.mono.medium,
  },
  inactiveLabel: {
    color: Colors.textTertiary,
  },
});
