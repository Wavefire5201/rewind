import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-reanimated';
import { useRunOnJS } from 'react-native-worklets-core';
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
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const contourData = useSharedValue<number[]>([]);
    const { detectFaces, getCurrentLandmarks, isAvailable: faceDetectionAvailable, sharedValues } = useFaceDetection();

    // Bridge face data from frame processor worklet → JS thread → shared values.
    // VisionCamera (worklets-core) and Reanimated 4 (react-native-worklets) use
    // different worklet runtimes, so shared values written directly in the frame
    // processor don't propagate to Reanimated's UI thread. useRunOnJS from
    // worklets-core creates a callable that properly bridges back to JS.
    // Preview is flipped iff facing === 'front' && !isMirrored — match that exactly
    // so the overlay stays aligned with what the user sees.
    const previewFlipped = facing === 'front' && !isMirrored;
    const onFaceDetected = useRunOnJS((data: Record<string, number>) => {
      if (previewFlipped) {
        data.faceX = 1 - data.faceX - data.faceWidth;
        data.leftEyeX = 1 - data.leftEyeX;
        data.rightEyeX = 1 - data.rightEyeX;
        data.noseX = 1 - data.noseX;
        data.mouthLeftX = 1 - data.mouthLeftX;
        data.mouthRightX = 1 - data.mouthRightX;
      }
      const sv = sharedValues;
      sv.faceX.value = data.faceX;
      sv.faceY.value = data.faceY;
      sv.faceWidth.value = data.faceWidth;
      sv.faceHeight.value = data.faceHeight;
      sv.leftEyeX.value = data.leftEyeX;
      sv.leftEyeY.value = data.leftEyeY;
      sv.rightEyeX.value = data.rightEyeX;
      sv.rightEyeY.value = data.rightEyeY;
      sv.noseX.value = data.noseX;
      sv.noseY.value = data.noseY;
      sv.mouthLeftX.value = data.mouthLeftX;
      sv.mouthLeftY.value = data.mouthLeftY;
      sv.mouthRightX.value = data.mouthRightX;
      sv.mouthRightY.value = data.mouthRightY;
      sv.rollAngle.value = data.rollAngle;
      sv.yawAngle.value = data.yawAngle;
      sv.hasFace.value = true;
    }, [sharedValues, previewFlipped]);

    const onNoFace = useRunOnJS(() => {
      sharedValues.hasFace.value = false;
      contourData.value = [];
    }, [sharedValues, contourData]);

    const onContourDetected = useRunOnJS((flat: number[]) => {
      if (previewFlipped) {
        for (let i = 0; i < flat.length; i += 2) {
          flat[i] = 1 - flat[i];
        }
      }
      contourData.value = flat;
    }, [previewFlipped, contourData]);

    const frameProcessor = useFrameProcessor(
      (frame) => {
        'worklet';
        try {
          const faces = detectFaces(frame);
          if (!faces || faces.length === 0) {
            onNoFace();
            return;
          }

          let largest = faces[0];
          let largestArea = 0;
          for (const face of faces) {
            const area = (face.bounds?.width ?? 0) * (face.bounds?.height ?? 0);
            if (area > largestArea) {
              largestArea = area;
              largest = face;
            }
          }

          const bounds = largest.bounds;
          if (!bounds) {
            onNoFace();
            return;
          }

          const frameW = frame.width || 1;
          const frameH = frame.height || 1;
          const lm = largest.landmarks;

          // MLKit on Android returns coords in the display-rotated space,
          // but frame.width/height reflect the raw sensor (landscape).
          // Normalize by swapped dimensions when sensor is landscape.
          const isLandscape = frameW > frameH;
          const normW = isLandscape ? frameH : frameW;
          const normH = isLandscape ? frameW : frameH;

          onFaceDetected({
            faceX: bounds.x / normW,
            faceY: bounds.y / normH,
            faceWidth: bounds.width / normW,
            faceHeight: bounds.height / normH,
            leftEyeX: lm?.LEFT_EYE ? lm.LEFT_EYE.x / normW : 0,
            leftEyeY: lm?.LEFT_EYE ? lm.LEFT_EYE.y / normH : 0,
            rightEyeX: lm?.RIGHT_EYE ? lm.RIGHT_EYE.x / normW : 0,
            rightEyeY: lm?.RIGHT_EYE ? lm.RIGHT_EYE.y / normH : 0,
            noseX: lm?.NOSE_BASE ? lm.NOSE_BASE.x / normW : 0,
            noseY: lm?.NOSE_BASE ? lm.NOSE_BASE.y / normH : 0,
            mouthLeftX: lm?.MOUTH_LEFT ? lm.MOUTH_LEFT.x / normW : 0,
            mouthLeftY: lm?.MOUTH_LEFT ? lm.MOUTH_LEFT.y / normH : 0,
            mouthRightX: lm?.MOUTH_RIGHT ? lm.MOUTH_RIGHT.x / normW : 0,
            mouthRightY: lm?.MOUTH_RIGHT ? lm.MOUTH_RIGHT.y / normH : 0,
            rollAngle: largest.rollAngle ?? 0,
            yawAngle: largest.yawAngle ?? 0,
          });

          // Pass face contour points as flat [x1,y1,x2,y2,...] array
          const faceContour = (largest as any).contours?.FACE;
          if (faceContour && faceContour.length > 0) {
            const flat: number[] = [];
            for (const p of faceContour) {
              flat.push(p.x / normW, p.y / normH);
            }
            onContourDetected(flat);
          }
        } catch (e: any) {
          console.log('[FrameProcessor] error:', e?.message || e);
        }
      },
      [detectFaces, onFaceDetected, onNoFace, onContourDetected],
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

    const onLayout = (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      setContainerSize({ width: w, height: h });
    };

    return (
      <View style={styles.container} onLayout={onLayout}>
        <Camera
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, { transform: [{ scaleX: facing === 'front' && !isMirrored ? -1 : 1 }] }]}
          device={device}
          isActive={true}
          photo={true}
          video={faceDetectionAvailable}
          frameProcessor={faceDetectionAvailable ? frameProcessor : undefined}
        />
        {ghostImageUri ? (
          <GhostOverlay
            imageUri={ghostImageUri}
            opacity={ghostOpacity}
            onOpacityChange={onGhostOpacityChange}
          />
        ) : null}
        <GridOverlay />
        {showFaceGuide ? (
          <>
            <FaceGuide
              faceX={sharedValues.faceX}
              faceY={sharedValues.faceY}
              faceWidth={sharedValues.faceWidth}
              faceHeight={sharedValues.faceHeight}
              hasFace={sharedValues.hasFace}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              contourData={contourData}
            />
          </>
        ) : null}
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
