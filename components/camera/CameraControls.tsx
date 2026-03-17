import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ArrowsClockwise, ArrowsLeftRight, Timer } from 'phosphor-react-native';
import { Colors } from '@/constants/theme';
import CircleButton from '@/components/ui/CircleButton';
import ShutterButton from '@/components/camera/ShutterButton';

interface CameraControlsProps {
  onCapture: () => void;
  onFlip: () => void;
  onTimerToggle: () => void;
  onMirrorToggle: () => void;
  isMirrored: boolean;
  isFrontCamera: boolean;
}

export default function CameraControls({
  onCapture,
  onFlip,
  onTimerToggle,
  onMirrorToggle,
  isMirrored,
  isFrontCamera,
}: CameraControlsProps) {
  return (
    <View style={styles.row}>
      <View style={styles.leftGroup}>
        <CircleButton onPress={onFlip} size={48} style={styles.buttonNoBorder}>
          <ArrowsClockwise size={20} color={Colors.textSecondary} weight="light" />
        </CircleButton>
        {isFrontCamera && (
          <CircleButton onPress={onMirrorToggle} size={36} style={styles.buttonNoBorder}>
            <ArrowsLeftRight size={16} color={isMirrored ? Colors.accent : Colors.textSecondary} weight="light" />
          </CircleButton>
        )}
      </View>
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
  leftGroup: {
    alignItems: 'center',
    gap: 6,
  },
  buttonNoBorder: {
    borderWidth: 0,
  },
});
