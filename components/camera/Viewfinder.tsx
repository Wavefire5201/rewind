import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { Colors } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import GridOverlay from '@/components/camera/GridOverlay';
import GhostOverlay from '@/components/camera/GhostOverlay';
import FaceGuide from '@/components/camera/FaceGuide';
import type { FaceLandmarks } from '@/types';

interface ViewfinderProps {
  ghostImageUri: string | null;
  facing: 'front' | 'back';
  ghostOpacity: number;
  onGhostOpacityChange: (value: number) => void;
  isMirrored: boolean;
  showFaceGuide: boolean;
}

export interface ViewfinderRef {
  takePhoto: () => Promise<{ uri: string } | undefined>;
  getCurrentLandmarks: () => FaceLandmarks | null;
}

const Viewfinder = forwardRef<ViewfinderRef, ViewfinderProps>(
  ({ ghostImageUri, facing, ghostOpacity, onGhostOpacityChange, isMirrored, showFaceGuide }, ref) => {
    const { typography } = useFont();
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice(facing);
    const cameraRef = useRef<Camera>(null);
    const { detectFaces, handleDetectedFaces, getCurrentLandmarks } = useFaceDetection();

    const frameProcessor = useFrameProcessor(
      (frame) => {
        'worklet';
        const faces = detectFaces(frame);
        handleDetectedFaces(faces, frame);
      },
      [detectFaces, handleDetectedFaces],
    );

    useImperativeHandle(ref, () => ({
      takePhoto: async () => {
        if (!cameraRef.current) return undefined;
        const photo = await cameraRef.current.takePhoto();
        return { uri: `file://${photo.path}` };
      },
      getCurrentLandmarks,
    }));

    if (!hasPermission) {
      return (
        <View style={[styles.container, styles.permissionContainer]}>
          <Text style={[typography.small, styles.permissionText]}>
            Camera access is required to take photos.
          </Text>
          <Text
            style={[typography.small, styles.permissionLink]}
            onPress={requestPermission}
          >
            Grant Permission
          </Text>
        </View>
      );
    }

    if (!device) {
      return (
        <View style={[styles.container, styles.permissionContainer]}>
          <Text style={[typography.small, styles.permissionText]}>
            No camera available.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Camera
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, { transform: [{ scaleX: facing === 'front' && !isMirrored ? -1 : 1 }] }]}
          device={device}
          isActive={true}
          photo={true}
          frameProcessor={frameProcessor}
        />
        {ghostImageUri ? (
          <GhostOverlay
            imageUri={ghostImageUri}
            opacity={ghostOpacity}
            onOpacityChange={onGhostOpacityChange}
          />
        ) : null}
        <GridOverlay />
        {showFaceGuide ? <FaceGuide /> : null}
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
