/**
 * Photo files are stored as q95 JPEGs, upright (EXIF orientation applied).
 *
 * Captures arrive at q98 and imports often at q100; those decoded ~33% slower for no visible
 * gain (PSNR 45 dB vs q95) and made 8x timelapse playback hold frames (measured on device:
 * 26 held vsyncs in 27 s at q100 vs 1 at q95). Files also shrink ~45%.
 */
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PhotoEntry } from '@/types';

export const PHOTO_ENCODING = 'q95' as const;
const QUALITY = 0.95;

/** Re-encodes `srcUri` at q95 into Documents as `name`; returns the new file's uri. */
export async function encodePhoto(srcUri: string, name: string): Promise<string> {
  return saveToDocuments(ImageManipulator.manipulate(srcUri), name, QUALITY);
}

/**
 * Thumbnail width: calendar cells, filmstrip tiles and album rows are at most ~60 dp, so this
 * covers them at 3x density. Decoding it instead of the full photo is ~1% of the pixels.
 */
export const THUMB_WIDTH = 192;
const THUMB_QUALITY = 0.8;

/** Writes a THUMB_WIDTH-wide copy of `srcUri` into Documents as `name`; returns its uri. */
export async function makeThumbnail(srcUri: string, name: string): Promise<string> {
  // Width only: the thumbnail keeps the photo's shape, so face positions still apply.
  return saveToDocuments(ImageManipulator.manipulate(srcUri).resize({ width: THUMB_WIDTH }), name, THUMB_QUALITY);
}

async function saveToDocuments(
  context: ReturnType<typeof ImageManipulator.manipulate>,
  name: string,
  compress: number,
): Promise<string> {
  let rendered: Awaited<ReturnType<typeof context.renderAsync>>;
  try {
    rendered = await context.renderAsync();
  } finally {
    context.release();
  }
  let saved: { uri: string };
  try {
    saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
  } finally {
    rendered.release();
  }
  const dest = new File(Paths.document, name);
  // Only a run that died before saving its photo entry can leave this behind; nothing points at it.
  if (dest.exists) dest.delete();
  await new File(saved.uri).move(dest);
  return dest.uri;
}

/** Documents file name for the q95 copy of an existing photo file. */
export function encodedName(uri: string): string {
  const base = (uri.split('/').pop() ?? 'photo').replace(/\.jpe?g$/i, '');
  return `${base}_q95.jpg`;
}

/** A local photo file not yet stored as q95. */
export function needsEncoding(photo: Pick<PhotoEntry, 'imageUri' | 'encoding'>): boolean {
  return photo.encoding !== PHOTO_ENCODING && photo.imageUri.startsWith('file://');
}

/** Documents file name for a photo file's thumbnail. */
export function thumbnailName(uri: string): string {
  const base = (uri.split('/').pop() ?? 'photo').replace(/\.jpe?g$/i, '');
  return `${base}_thumb.jpg`;
}

/**
 * A stored photo without a thumbnail yet. Waits for the q95 pass, so the thumbnail is made
 * from the file that stays (a not-yet-encoded file is about to be replaced).
 */
export function needsThumbnail(photo: Pick<PhotoEntry, 'imageUri' | 'encoding' | 'thumbUri'>): boolean {
  return !photo.thumbUri && photo.encoding === PHOTO_ENCODING && photo.imageUri.startsWith('file://');
}
