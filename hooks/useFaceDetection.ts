import { useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { Frame } from 'react-native-vision-camera';
import type { FaceLandmarks } from '@/types';

// MLKit face detection is only available on physical devices (not simulator).
// We test availability at module load time by trying to call useFaceDetector.
// If the native plugin isn't registered, we set FACE_DETECTION_AVAILABLE = false
// and provide a no-op hook.
let FACE_DETECTION_AVAILABLE = false;
let useFaceDetectorHook: any = null;
let DETECTION_OPTIONS: any = null;

try {
  const mod = require('react-native-vision-camera-face-detector');
  // Test if the native plugin is actually registered by checking VisionCameraProxy
  const { VisionCameraProxy } = require('react-native-vision-camera');
  const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectFaces', {});
  if (!plugin) throw new Error('Plugin not registered');
  useFaceDetectorHook = mod.useFaceDetector;
  DETECTION_OPTIONS = {
    performanceMode: 'fast',
    landmarkMode: 'all',
    classificationMode: 'none',
    contourMode: 'all',
    minFaceSize: 0.15,
    trackingEnabled: true,
  };
  FACE_DETECTION_AVAILABLE = true;
  console.log('[FaceDetection] ✅ MLKit plugin available');
} catch (e) {
  console.log('[FaceDetection] ⚠️ MLKit plugin unavailable:', (e as Error).message);
}

export interface FaceDetectionResult {
  landmarks: FaceLandmarks | null;
  isAvailable: boolean;
}

/**
 * Hook that provides face detection via MLKit frame processor.
 * Returns shared values for smooth 60fps UI updates and a frame processor callback.
 * Gracefully degrades on simulator where MLKit is unavailable.
 */
// No-op hook that matches useFaceDetector's return shape
function useNoopFaceDetector(_options: any) {
  const noopDetect = useCallback((_frame: any) => [], []);
  return { detectFaces: noopDetect };
}

export function useFaceDetection() {
  // Always call a hook (Rules of Hooks) — use the real one or the no-op
  const useDetector = FACE_DETECTION_AVAILABLE ? useFaceDetectorHook : useNoopFaceDetector;
  const { detectFaces } = useDetector(DETECTION_OPTIONS);

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
  const mouthLeftX = useSharedValue(0);
  const mouthLeftY = useSharedValue(0);
  const mouthRightX = useSharedValue(0);
  const mouthRightY = useSharedValue(0);
  const rollAngle = useSharedValue(0);
  const yawAngle = useSharedValue(0);
  const hasFace = useSharedValue(false);

  const handleDetectedFaces = useCallback(
    (faces: any[], _frame: Frame) => {
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

      // Normalize coordinates to 0-1 using frame dimensions.
      // NOTE: camera frame is rotated 90° relative to portrait view, so frame.width/height
      // are swapped relative to what you'd expect. Frame width = device height in portrait.
      const frameW = _frame.width || 1;
      const frameH = _frame.height || 1;

      faceX.value = bounds.x / frameW;
      faceY.value = bounds.y / frameH;
      faceWidth.value = bounds.width / frameW;
      faceHeight.value = bounds.height / frameH;

      const leftEye = largest.landmarks?.LEFT_EYE;
      const rightEye = largest.landmarks?.RIGHT_EYE;
      const nose = largest.landmarks?.NOSE_BASE;
      const mouthLeft = largest.landmarks?.MOUTH_LEFT;
      const mouthRight = largest.landmarks?.MOUTH_RIGHT;
      if (leftEye) {
        leftEyeX.value = leftEye.x / frameW;
        leftEyeY.value = leftEye.y / frameH;
      }
      if (rightEye) {
        rightEyeX.value = rightEye.x / frameW;
        rightEyeY.value = rightEye.y / frameH;
      }
      if (nose) {
        noseX.value = nose.x / frameW;
        noseY.value = nose.y / frameH;
      }
      if (mouthLeft) {
        mouthLeftX.value = mouthLeft.x / frameW;
        mouthLeftY.value = mouthLeft.y / frameH;
      }
      if (mouthRight) {
        mouthRightX.value = mouthRight.x / frameW;
        mouthRightY.value = mouthRight.y / frameH;
      }
      rollAngle.value = largest.rollAngle ?? 0;
      yawAngle.value = largest.yawAngle ?? 0;
      hasFace.value = true;
    },
    [],
  );

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
    isAvailable: FACE_DETECTION_AVAILABLE,
    sharedValues: {
      faceX, faceY, faceWidth, faceHeight,
      leftEyeX, leftEyeY, rightEyeX, rightEyeY,
      noseX, noseY, rollAngle, yawAngle, hasFace,
      mouthLeftX, mouthLeftY, mouthRightX, mouthRightY,
    },
  };
}
