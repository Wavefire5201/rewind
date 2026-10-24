import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

interface ExportProgressProps {
  visible: boolean;
  label: string;
  current: number;
  total: number;
  onCancel: () => void;
}

/** Export/import progress as a sheet that stays up until the work ends or is cancelled. */
export default function ExportProgress({ visible, label, current, total, onCancel }: ExportProgressProps) {
  const { fonts } = useFont();
  const fillPercent = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <BottomSheet visible={visible} onClose={onCancel} dismissible={false}>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { fontFamily: fonts.regular }]} numberOfLines={1}>{label}</Text>
          <Text style={[styles.count, { fontFamily: fonts.regular }]}>{`${current} / ${total}`}</Text>
        </View>

        <View style={styles.track}>
          <View testID="export-progress-fill" style={[styles.fill, { width: `${fillPercent}%` }]} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && { opacity: Pressed.text }]}
          onPress={() => { haptics.tap(); onCancel(); }}
          accessibilityRole="button"
          accessibilityLabel="cancel"
        >
          <Text style={[styles.cancelText, { fontFamily: fonts.regular }]}>cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingTop: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  count: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 2,
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: Colors.accent,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  cancelText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
});
