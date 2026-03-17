import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface ExportProgressProps {
  visible: boolean;
  label: string;
  current: number;
  total: number;
  onCancel: () => void;
}

export default function ExportProgress({ visible, label, current, total, onCancel }: ExportProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const fillPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.label}>{label}</Text>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${fillPercent}%` }]} />
          </View>

          <Text style={styles.percent}>{percent}%</Text>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
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
    color: '#E85D5D',
  },
});
