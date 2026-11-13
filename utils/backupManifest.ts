/**
 * The entries of a backup's manifest.json.
 *
 * Version 1 has each photo's id, date, caption and image file. Version 2 adds what saves work
 * after a restore: the q95 flag (the image is restored byte for byte, so it is still q95), the
 * face scan, the capture time and camera, and the capture's face landmarks (the camera's ghost
 * reads them). Thumbnails stay out; the backfill rebuilds them. Version 3 adds the album's
 * weights and weight goal.
 */
import { FACE_SCAN_VERSION } from '@/utils/faceScan';
import { PHOTO_ENCODING } from '@/utils/photoEncode';
import type { FaceLandmarks, FaceMeasure, FaceScan, PhotoEntry, WeightEntry, WeightValue } from '@/types';
import { isValidWeight } from '@/utils/weight';

export const BACKUP_VERSION = 3;

export type BackupPhoto = Pick<PhotoEntry, 'id' | 'date' | 'caption' | 'capturedAt' | 'cameraDirection'>
  & Partial<Pick<PhotoEntry, 'encoding' | 'faceScan' | 'faceLandmarks'>>
  & { imageFile: string };

export function backupPhoto(photo: PhotoEntry, imageFile: string): BackupPhoto {
  return {
    id: photo.id,
    date: photo.date,
    caption: photo.caption,
    imageFile,
    capturedAt: photo.capturedAt,
    cameraDirection: photo.cameraDirection,
    // Left out of the JSON when undefined.
    encoding: photo.encoding,
    faceScan: photo.faceScan,
    faceLandmarks: photo.faceLandmarks,
  };
}

/** A weight in the manifest: the album is the one restored into. */
export type BackupWeight = Omit<WeightEntry, 'albumId'>;

export function backupWeight(w: WeightEntry): BackupWeight {
  return { date: w.date, value: w.value, unit: w.unit, updatedAt: w.updatedAt };
}

/**
 * The manifest's weights, for `albumId`. Untrusted input: an entry that isn't a weight on a real
 * day is dropped and the rest kept; a second entry for a day is dropped too. No list (an older
 * backup) is no weights.
 */
export function readWeights(v: unknown, albumId: string, isDay: (s: unknown) => s is string): WeightEntry[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const weights: WeightEntry[] = [];
  for (const e of v) {
    if (!isObject(e) || !isDay(e.date) || seen.has(e.date)) continue;
    const weight = readWeightValue(e);
    if (!weight) continue;
    seen.add(e.date);
    weights.push({ albumId, date: e.date, ...weight, updatedAt: readTimestamp(e.updatedAt) ?? new Date().toISOString() });
  }
  return weights;
}

/** A weight value and unit, or undefined when it isn't a plausible weight. */
export function readWeightValue(v: unknown): WeightValue | undefined {
  if (!isObject(v) || !isNumber(v.value) || (v.unit !== 'lb' && v.unit !== 'kg')) return undefined;
  const w: WeightValue = { value: v.value, unit: v.unit };
  return isValidWeight(w) ? w : undefined;
}

export type PhotoDetails = Partial<Pick<PhotoEntry, 'capturedAt' | 'cameraDirection' | 'encoding' | 'faceScan' | 'faceLandmarks'>>;

/**
 * The version 2 details of one manifest entry. The manifest is untrusted input: each detail
 * is checked and copied field by field, and one that is malformed is left out, so the photo
 * is restored without it (a missing scan is redone by the backfill).
 */
export function readPhotoDetails(entry: Record<string, unknown>): PhotoDetails {
  const details: PhotoDetails = {};
  const capturedAt = readTimestamp(entry.capturedAt);
  if (capturedAt) details.capturedAt = capturedAt;
  if (entry.cameraDirection === 'front' || entry.cameraDirection === 'back') details.cameraDirection = entry.cameraDirection;
  if (entry.encoding === PHOTO_ENCODING) details.encoding = PHOTO_ENCODING;
  const faceScan = readFaceScan(entry.faceScan);
  if (faceScan) details.faceScan = faceScan;
  const faceLandmarks = readFaceLandmarks(entry.faceLandmarks);
  if (faceLandmarks) details.faceLandmarks = faceLandmarks;
  return details;
}

type Point = { x: number; y: number };

const MEASURE_KEYS = [
  'ipd', 'closeness', 'jaw', 'lowJaw', 'cheek', 'yaw', 'pitch', 'roll', 'smile', 'jawOpen',
] as const satisfies readonly (keyof FaceMeasure)[];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function readPoint(v: unknown): Point | undefined {
  return isObject(v) && isNumber(v.x) && isNumber(v.y) ? { x: v.x, y: v.y } : undefined;
}

function readTimestamp(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

function readFaceScan(v: unknown): FaceScan | undefined {
  if (!isObject(v)) return undefined;
  const { v: version, width, height, eyes, measure } = v;
  // A scan from a newer app has a format this one can't check: leave it to be redone.
  if (!isNumber(version) || !Number.isInteger(version) || version < 1 || version > FACE_SCAN_VERSION) return undefined;
  if (!isNumber(width) || width <= 0 || !isNumber(height) || height <= 0) return undefined;

  let scanEyes: FaceScan['eyes'] = null;
  if (eyes !== null) {
    const left = isObject(eyes) ? readPoint(eyes.left) : undefined;
    const right = isObject(eyes) ? readPoint(eyes.right) : undefined;
    if (!left || !right) return undefined;
    scanEyes = { left, right };
  }
  const scan: FaceScan = { v: version, eyes: scanEyes, width, height };

  if (measure === undefined) {
    // Scans have carried measurements since v2; a current one without them would never be redone.
    return version >= 2 ? undefined : scan;
  }
  if (measure === null) return { ...scan, measure: null };
  if (!isObject(measure)) return undefined;
  const values: Partial<FaceMeasure> = {};
  for (const key of MEASURE_KEYS) {
    const value = measure[key];
    if (!isNumber(value)) return undefined;
    values[key] = value;
  }
  return { ...scan, measure: values as FaceMeasure };
}

function readFaceLandmarks(v: unknown): FaceLandmarks | undefined {
  if (!isObject(v)) return undefined;
  const leftEye = readPoint(v.leftEye);
  const rightEye = readPoint(v.rightEye);
  const noseTip = readPoint(v.noseTip);
  const bounds = v.faceBounds;
  const { rollAngle, yawAngle, isMirrored } = v;
  if (!leftEye || !rightEye || !noseTip || !isObject(bounds)) return undefined;
  const { x, y, width, height } = bounds;
  if (!isNumber(x) || !isNumber(y) || !isNumber(width) || !isNumber(height)) return undefined;
  if (!isNumber(rollAngle) || !isNumber(yawAngle) || typeof isMirrored !== 'boolean') return undefined;
  return { leftEye, rightEye, noseTip, faceBounds: { x, y, width, height }, rollAngle, yawAngle, isMirrored };
}
