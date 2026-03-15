import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Typography } from '@/constants/theme';
import GridOverlay from '@/components/camera/GridOverlay';
import GhostOverlay from '@/components/camera/GhostOverlay';

interface ViewfinderProps {
  ghostImageUri: string | null;
  facing: 'front' | 'back';
  ghostOpacity: number;
  onGhostOpacityChange: (value: number) => void;
}

const Viewfinder = forwardRef<CameraView, ViewfinderProps>(
  ({ ghostImageUri, facing, ghostOpacity, onGhostOpacityChange }, ref) => {
    const [permission, requestPermission] = useCameraPermissions();

    if (!permission) {
      return <View style={styles.container} />;
    }

    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.permissionContainer]}>
          <Text style={[Typography.small, styles.permissionText]}>
            Camera access is required to take photos.
          </Text>
          <Text
            style={[Typography.small, styles.permissionLink]}
            onPress={requestPermission}
          >
            Grant Permission
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView ref={ref} style={StyleSheet.absoluteFill} facing={facing} />
        {ghostImageUri ? (
          <GhostOverlay
            imageUri={ghostImageUri}
            opacity={ghostOpacity}
            onOpacityChange={onGhostOpacityChange}
          />
        ) : null}
        <GridOverlay />
      </View>
    );
  }
);

Viewfinder.displayName = 'Viewfinder';

export default Viewfinder;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  permissionText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionLink: {
    color: Colors.accent,
    textAlign: 'center',
  },
});
