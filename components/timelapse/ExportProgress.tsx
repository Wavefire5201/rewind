import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';

interface ExportProgressProps {
  visible: boolean;
  label: string;
  current: number;
  total: number;
  onCancel: () => void;
}

export default function ExportProgress({ visible, label, current, total, onCancel }: ExportProgressProps) {
  const { fonts } = useFont();
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const fillPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={[styles.label, { fontFamily: fonts.regular }]}>{label}</Text>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${fillPercent}%` }]} />
          </View>

          <Text style={[styles.percent, { fontFamily: fonts.regular }]}>{percent}%</Text>

          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]} onPress={onCancel}>
            <Text style={[styles.cancelText, { fontFamily: fonts.regular }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: Colors.bgCard,
    padding: 24,
    width: '100%',
    gap: 12,
  },
  label: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  track: {
    height: 4,
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: Colors.accent,
  },
  percent: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  cancelText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.danger,
  },
});
