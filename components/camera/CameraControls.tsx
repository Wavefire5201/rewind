import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ArrowsClockwise, Timer } from 'phosphor-react-native';
import { Colors } from '@/constants/theme';
import CircleButton from '@/components/ui/CircleButton';
import ShutterButton from '@/components/camera/ShutterButton';

interface CameraControlsProps {
  onCapture: () => void;
  onFlip: () => void;
  onTimerToggle: () => void;
}

export default function CameraControls({ onCapture, onFlip, onTimerToggle }: CameraControlsProps) {
  return (
    <View style={styles.row}>
      <CircleButton onPress={onFlip} size={48} style={styles.buttonNoBorder}>
        <ArrowsClockwise size={20} color={Colors.textSecondary} weight="light" />
      </CircleButton>
      <ShutterButton onPress={onCapture} />
      <CircleButton onPress={onTimerToggle} size={48} style={styles.buttonNoBorder}>
        <Timer size={20} color={Colors.textSecondary} weight="light" />
      </CircleButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  buttonNoBorder: {
    borderWidth: 0,
  },
});
