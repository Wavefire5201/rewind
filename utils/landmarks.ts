import type { FaceLandmarks } from '@/types';

/**
 * Compute inter-pupillary distance (Euclidean distance between left and right eye centers).
 */
export function computeIPD(landmarks: FaceLandmarks): number {
  const dx = landmarks.rightEye.x - landmarks.leftEye.x;
  const dy = landmarks.rightEye.y - landmarks.leftEye.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the midpoint between left and right eye centers.
 */
export function computeEyeMidpoint(landmarks: FaceLandmarks): { x: number; y: number } {
  return {
    x: (landmarks.leftEye.x + landmarks.rightEye.x) / 2,
    y: (landmarks.leftEye.y + landmarks.rightEye.y) / 2,
  };
}

/**
 * Compute alignment score (0-1) between current face and reference face.
 * Returns 0 if no reference, extreme angle, or faces are very different in position.
 */
export function computeAlignmentScore(
  current: FaceLandmarks,
  reference: FaceLandmarks | undefined,
  viewWidth: number,
  viewHeight: number,
): number {
  if (!reference) return 0;
  if (Math.abs(current.yawAngle) > 30) return 0;

  const currentMid = computeEyeMidpoint(current);
  const refMid = computeEyeMidpoint(reference);

  // Normalize positions to 0-1 range
  const dx = Math.abs(currentMid.x - refMid.x) / viewWidth;
  const dy = Math.abs(currentMid.y - refMid.y) / viewHeight;
  const positionDelta = Math.sqrt(dx * dx + dy * dy);

  // IPD ratio (scale difference)
  const currentIPD = computeIPD(current);
  const refIPD = computeIPD(reference);
  const scaleDelta = Math.abs(1 - currentIPD / refIPD);

  // Roll angle difference
  const rollDelta = Math.abs(current.rollAngle - reference.rollAngle) / 45; // normalize to 0-1

  // Weighted combination: position matters most, then scale, then roll
  const score = Math.max(0, 1 - (positionDelta * 3 + scaleDelta * 2 + rollDelta));
  return Math.min(1, score);
}

/**
 * Compute affine transform to align a ghost image's face to the live face.
 * Returns scale and translate values to apply to the ghost image.
 */
export function computeGhostTransform(
  liveLandmarks: FaceLandmarks,
  ghostLandmarks: FaceLandmarks,
): { scaleX: number; scaleY: number; translateX: number; translateY: number } {
  const liveIPD = computeIPD(liveLandmarks);
  const ghostIPD = computeIPD(ghostLandmarks);
  const scale = liveIPD / ghostIPD;

  const liveMid = computeEyeMidpoint(liveLandmarks);
  const ghostMid = computeEyeMidpoint(ghostLandmarks);

  // After scaling, ghost midpoint moves by scale factor
  const scaledGhostMidX = ghostMid.x * scale;
  const scaledGhostMidY = ghostMid.y * scale;

  return {
    scaleX: scale,
    scaleY: scale,
    translateX: liveMid.x - scaledGhostMidX,
    translateY: liveMid.y - scaledGhostMidY,
  };
}

/**
 * Compute affine transform for export centering.
 * Maps face to canonical position (eyes at 40% from top, horizontally centered).
 */
export function computeExportTransform(
  landmarks: FaceLandmarks,
  outputWidth: number,
  outputHeight: number,
  canonicalIPD: number = outputWidth * 0.25,
): { scale: number; translateX: number; translateY: number; rotate: number } {
  const ipd = computeIPD(landmarks);
  const scale = canonicalIPD / ipd;

  const eyeMid = computeEyeMidpoint(landmarks);
  const canonicalX = outputWidth / 2;
  const canonicalY = outputHeight * 0.4;

  return {
    scale,
    translateX: canonicalX - eyeMid.x * scale,
    translateY: canonicalY - eyeMid.y * scale,
    rotate: -landmarks.rollAngle * (Math.PI / 180),
  };
}
