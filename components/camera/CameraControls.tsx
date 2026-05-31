import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ArrowsClockwise, ArrowsLeftRight, Timer } from 'phosphor-react-native';
import { Colors } from '@/constants/theme';
import CircleButton from '@/components/ui/CircleButton';
import ShutterButton from '@/components/camera/ShutterButton';

interface CameraControlsProps {
  onCapture: () => void;
  onCaptureReference?: () => void;
  onFlip: () => void;
  onTimerToggle: () => void;
  onMirrorToggle: () => void;
  isMirrored: boolean;
  isFrontCamera: boolean;
  autoCaptureProgress?: number;
  isInCooldown?: boolean;
  hasAlignmentTarget?: boolean;
  isCapturing?: boolean;
}

export default function CameraControls({
  onCapture,
  onCaptureReference,
  onFlip,
  onTimerToggle,
  onMirrorToggle,
  isMirrored,
  isFrontCamera,
  autoCaptureProgress,
  isInCooldown,
  hasAlignmentTarget,
  isCapturing,
}: CameraControlsProps) {
  return (
    <View style={styles.row}>
      <CircleButton
        onPress={onFlip}
        size={48}
        style={styles.buttonNoBorder}
        accessibilityLabel="Flip camera"
        accessibilityRole="button"
      >
        <ArrowsClockwise size={20} color={Colors.textSecondary} weight="light" />
      </CircleButton>
      <ShutterButton onPress={onCapture} onLongPress={onCaptureReference} autoCaptureProgress={autoCaptureProgress} isInCooldown={isInCooldown} hasAlignmentTarget={hasAlignmentTarget} disabled={isCapturing} />
      {isFrontCamera ? (
        <CircleButton
          onPress={onMirrorToggle}
          size={48}
          style={styles.buttonNoBorder}
          accessibilityLabel={isMirrored ? 'Disable mirror' : 'Enable mirror'}
          accessibilityRole="button"
        >
          <ArrowsLeftRight size={20} color={isMirrored ? Colors.accent : Colors.textSecondary} weight="light" />
        </CircleButton>
      ) : (
        <CircleButton
          onPress={onTimerToggle}
          size={48}
          style={styles.buttonNoBorder}
          accessibilityLabel="Timer"
          accessibilityRole="button"
        >
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
