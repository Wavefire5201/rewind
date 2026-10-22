import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { strFromU8 } from 'fflate';
import type { PhotoEntry } from '@/types';
import { readZipEntries, readZipEntry, type ByteSource, type ZipEntry } from '@/utils/zipReader';
import { readPhotoDetails } from '@/utils/backupManifest';

export async function pickPhotosFromLibrary(
  { multiple = true }: { multiple?: boolean } = {},
): Promise<{ uri: string; date: string | null }[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 1,
    exif: true,
  });
  if (result.canceled) return [];
  return result.assets.map(asset => ({ uri: asset.uri, date: exifDate(asset.exif?.DateTimeOriginal) }));
}

// EXIF dates read "YYYY:MM:DD HH:MM:SS". Screenshots and edited or downloaded images often
// have none (or zeros): that's null, for the caller to decide, never silently today.
function exifDate(raw: unknown): string | null {
  if (raw == null) return null;
  const date = String(raw).split(' ')[0].replace(/:/g, '-');
  if (!isValidDate(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  return y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? date : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real day as YYYY-MM-DD: '2026-02-30' has the shape but isn't one. */
function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  return day.getUTCFullYear() === y && day.getUTCMonth() === m - 1 && day.getUTCDate() === d;
}

export async function importFromBackup(
  albumId: string = 'daily-selfie',
  onProgress?: (current: number, total: number) => void,
  cancelSignal?: { cancelled: boolean },
  /** Days the album already has a photo for: skipped without writing them. */
  existingDates: ReadonlySet<string> = new Set(),
): Promise<BackupImport> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return { photos: [], skipped: 0, unreadable: 0 };
  const srcFile = new File(result.assets[0].uri);
  // Random access through a file handle: read the zip's directory, then one photo at a
  // time. Loading the whole backup (base64 + JSZip) needs several times its size in JS
  // memory, which a year of photos (1+ GB) cannot survive.
  const handle = srcFile.open();
  try {
    const src: ByteSource = {
      size: handle.size ?? srcFile.size,
      read(offset, length) {
        handle.offset = offset;
        return handle.readBytes(length);
      },
    };
    // Awaited so the handle stays open until the last photo is read.
    return await readBackupEntries(src, albumId, existingDates, onProgress, cancelSignal);
  } finally {
    handle.close();
    // The picker copied the backup into the cache — possibly gigabytes; don't leave it there.
    try { srcFile.delete(); } catch {}
  }
}

export interface BackupImport {
  photos: PhotoEntry[];
  /** Entries for a day the album, or an earlier entry in the backup, already has. */
  skipped: number;
  /** Entries that couldn't be restored: malformed, without a valid date, missing their image, or failing to write. */
  unreadable: number;
}

// Lets queued work run: a Cancel tap, the progress count re-rendering.
const yieldToApp = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function readBackupEntries(
  src: ByteSource,
  albumId: string,
  existingDates: ReadonlySet<string>,
  onProgress?: (current: number, total: number) => void,
  cancelSignal?: { cancelled: boolean },
): Promise<BackupImport> {
  const entries = readZipEntries(src);
  const manifestEntry = entries.get('manifest.json');
  if (!manifestEntry) throw new Error('Invalid backup: no manifest.json found');
  const manifest = JSON.parse(strFromU8(readZipEntry(src, manifestEntry)));

  // I1: validate manifest shape
  if (!manifest || !Array.isArray(manifest.photos)) {
    throw new Error('Invalid backup format: manifest.photos is missing or not an array');
  }

  // Version 1 entries are read as they always were: the photo details came with version 2.
  const withDetails = typeof manifest.version === 'number' && manifest.version >= 2;
  const photos: PhotoEntry[] = [];
  const total = manifest.photos.length;
  const takenDates = new Set(existingDates);
  let skipped = 0;
  let unreadable = 0;
  try {
    for (let i = 0; i < total; i++) {
      // Each photo is read and written synchronously; without a yield between them the
      // whole restore (a gigabyte or more) blocks the JS thread, so neither progress nor
      // Cancel could get through until it finished.
      if (i > 0) await yieldToApp();
      // Honor cancellation between entries (reading one photo isn't interruptible,
      // so we stop before reading the next one).
      if (cancelSignal?.cancelled) throw new Error('Cancelled');

      const restored = restoreEntry(src, entries, manifest.photos[i], i, albumId, takenDates, withDetails);
      if (restored === 'skipped') skipped++;
      else if (restored === 'unreadable') unreadable++;
      else {
        takenDates.add(restored.date);
        photos.push(restored);
      }
      // Every entry moves the bar, whatever became of it.
      onProgress?.(i + 1, total);
    }
  } catch (e) {
    // Cancelled or failed: nothing will reference what was written so far.
    for (const p of photos) {
      try { new File(p.imageUri).delete(); } catch {}
    }
    throw e;
  }
  return { photos, skipped, unreadable };
}

/** One manifest entry: its photo, or why it wasn't restored. */
function restoreEntry(
  src: ByteSource,
  entries: ReadonlyMap<string, ZipEntry>,
  entry: unknown,
  index: number,
  albumId: string,
  takenDates: ReadonlySet<string>,
  withDetails: boolean,
): PhotoEntry | 'skipped' | 'unreadable' {
  if (!entry || typeof entry !== 'object') return 'unreadable';
  const { date, imageFile, caption } = entry as Record<string, unknown>;

  // No day to put it on. Moved to today, an old photo would take today's place.
  if (!isValidDate(date)) return 'unreadable';
  // A day the album already has (or an earlier entry here filled): don't write it at all.
  if (takenDates.has(date)) return 'skipped';

  const imageEntry = typeof imageFile === 'string' ? entries.get(imageFile) : undefined;
  if (!imageEntry) return 'unreadable';
  const imageBytes = readZipEntry(src, imageEntry);

  // I1: append the entry index to avoid same-millisecond filename collisions
  const filename = `rewind_import_${Date.now()}_${index}_${date}.jpg`;
  const destFile = new File(Paths.document, filename);
  try {
    destFile.write(imageBytes);
  } catch {
    // Don't leave a partial file that nothing points at.
    try { destFile.delete(); } catch {}
    return 'unreadable';
  }

  return {
    id: `import_${Date.now()}-${Math.random().toString(36).slice(2, 8)}_${date}`,
    albumId,
    date,
    imageUri: destFile.uri,
    caption: typeof caption === 'string' ? caption : '',
    capturedAt: new Date().toISOString(),
    cameraDirection: 'front',
    ...(withDetails ? readPhotoDetails(entry as Record<string, unknown>) : {}),
  };
}

// I2: createPhotoEntry treats a failed copy as a HARD failure - throws instead of
// persisting the volatile picker-cache URI which will be evicted later.
export async function createPhotoEntry(uri: string, date: string, caption: string = '', albumId: string = 'daily-selfie'): Promise<PhotoEntry> {
  const filename = `rewind_import_${Date.now()}.jpg`;
  const src = new File(uri);
  const dest = new File(Paths.document, filename);
  // Intentionally not catching: callers must handle this exception and skip/count as failed
  await src.copy(dest);
  return {
    id: `import_${Date.now()}-${Math.random().toString(36).slice(2, 8)}_${date}`,
    albumId, date, imageUri: dest.uri, caption,
    capturedAt: new Date().toISOString(),
    cameraDirection: 'front',
  };
}
