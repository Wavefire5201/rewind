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
      <CircleButton onPress={onFlip} size={48} style={styles.buttonNoBorder}>
        <ArrowsClockwise size={20} color={Colors.textSecondary} weight="light" />
      </CircleButton>
      <ShutterButton onPress={onCapture} />
      {isFrontCamera ? (
        <CircleButton onPress={onMirrorToggle} size={48} style={styles.buttonNoBorder}>
          <ArrowsLeftRight size={20} color={isMirrored ? Colors.accent : Colors.textSecondary} weight="light" />
        </CircleButton>
      ) : (
        <CircleButton onPress={onTimerToggle} size={48} style={styles.buttonNoBorder}>
          <Timer size={20} color={Colors.textSecondary} weight="light" />
        </CircleButton>
      )}
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
