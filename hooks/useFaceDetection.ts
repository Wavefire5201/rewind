import { useCallback, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import {
  useFaceDetector,
  type FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import type { Frame } from 'react-native-vision-camera';
import type { FaceLandmarks } from '@/types';

const DETECTION_OPTIONS: FrameFaceDetectionOptions = {
  performanceMode: 'fast',
  landmarkMode: 'all',
  classificationMode: 'none',
  contourMode: 'none',
  minFaceSize: 0.15,
  trackingEnabled: true,
};

export interface FaceDetectionResult {
  /** Current face landmarks in view coordinates, or null if no face */
  landmarks: FaceLandmarks | null;
  /** Whether face detection is available */
  isAvailable: boolean;
}

/**
 * Hook that provides face detection via MLKit frame processor.
 * Returns shared values for smooth 60fps UI updates and a frame processor callback.
 */
export function useFaceDetection() {
  const { detectFaces } = useFaceDetector(DETECTION_OPTIONS);
  const isAvailableRef = useRef(true);

  // Shared values for smooth UI updates (read by FaceGuide, GhostOverlay, etc.)
  const faceX = useSharedValue(0);
  const faceY = useSharedValue(0);
  const faceWidth = useSharedValue(0);
  const faceHeight = useSharedValue(0);
  const leftEyeX = useSharedValue(0);
  const leftEyeY = useSharedValue(0);
  const rightEyeX = useSharedValue(0);
  const rightEyeY = useSharedValue(0);
  const noseX = useSharedValue(0);
  const noseY = useSharedValue(0);
  const rollAngle = useSharedValue(0);
  const yawAngle = useSharedValue(0);
  const hasFace = useSharedValue(false);

  const handleDetectedFaces = useCallback(
    (faces: any[], frame: Frame) => {
      'worklet';
      if (!faces || faces.length === 0) {
        hasFace.value = false;
        return;
      }

      // Use the largest face by bounding box area
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
        hasFace.value = false;
        return;
      }

      // Update shared values with minimal data
      faceX.value = bounds.x;
      faceY.value = bounds.y;
      faceWidth.value = bounds.width;
      faceHeight.value = bounds.height;

      // Extract landmark positions (MLKit landmark indices)
      const leftEye = largest.landmarks?.LEFT_EYE;
      const rightEye = largest.landmarks?.RIGHT_EYE;
      const nose = largest.landmarks?.NOSE_BASE;

      if (leftEye) {
        leftEyeX.value = leftEye.x;
        leftEyeY.value = leftEye.y;
      }
      if (rightEye) {
        rightEyeX.value = rightEye.x;
        rightEyeY.value = rightEye.y;
      }
      if (nose) {
        noseX.value = nose.x;
        noseY.value = nose.y;
      }

      rollAngle.value = largest.rollAngle ?? 0;
      yawAngle.value = largest.yawAngle ?? 0;
      hasFace.value = true;
    },
    [],
  );

  /** Extract current landmarks as a plain object (for storing with photos) */
  const getCurrentLandmarks = useCallback((): FaceLandmarks | null => {
    if (!hasFace.value) return null;
    return {
      leftEye: { x: leftEyeX.value, y: leftEyeY.value },
      rightEye: { x: rightEyeX.value, y: rightEyeY.value },
      noseTip: { x: noseX.value, y: noseY.value },
      faceBounds: {
        x: faceX.value,
        y: faceY.value,
        width: faceWidth.value,
        height: faceHeight.value,
      },
      rollAngle: rollAngle.value,
      yawAngle: yawAngle.value,
    };
  }, []);

  return {
    detectFaces,
    handleDetectedFaces,
    getCurrentLandmarks,
    isAvailable: isAvailableRef.current,
    sharedValues: {
      faceX,
      faceY,
      faceWidth,
      faceHeight,
      leftEyeX,
      leftEyeY,
      rightEyeX,
      rightEyeY,
      noseX,
      noseY,
      rollAngle,
      yawAngle,
      hasFace,
    },
  };
}
