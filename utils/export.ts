import { File, Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import type { PhotoEntry } from '@/types';
import { BACKUP_VERSION, backupPhoto, type BackupPhoto } from '@/utils/backupManifest';

type ProgressCallback = (current: number, total: number) => void;
type CancelToken = { cancelled: boolean };

function isLocalFile(uri: string): boolean {
  return uri.startsWith('file://');
}

function getExportDir(): Directory {
  return new Directory(Paths.cache, 'rewind-export');
}

function cleanupExportDir() {
  try {
    const dir = getExportDir();
    if (dir.exists) dir.delete();
  } catch {}
}

export interface ExportResult {
  exported: number;
  skipped: number;
}

export async function exportToPhotoAlbum(
  photos: PhotoEntry[],
  onProgress: ProgressCallback,
  cancel: CancelToken
): Promise<ExportResult> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Permission denied');

  const localPhotos = photos.filter(p => isLocalFile(p.imageUri));
  const skipped = photos.length - localPhotos.length;
  if (localPhotos.length === 0) {
    const msg = skipped > 0
      ? `All ${skipped} photo${skipped !== 1 ? 's' : ''} are remote and cannot be exported.`
      : 'No local photos to export.';
    throw new Error(msg);
  }

  let album = await MediaLibrary.getAlbumAsync('Rewind');
  let lastSaved = 0;
  for (let i = 0; i < localPhotos.length; i++) {
    if (cancel.cancelled) throw new Error('Cancelled');
    const asset = await MediaLibrary.createAssetAsync(localPhotos[i].imageUri);
    if (!album) {
      album = await MediaLibrary.createAlbumAsync('Rewind', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
    lastSaved = i + 1;
    onProgress(lastSaved, localPhotos.length);
  }
  return { exported: localPhotos.length, skipped };
}

/**
 * A backup can't pass 4 GiB. fflate's Zip writes no ZIP64, so every size and offset in the
 * archive is a 32-bit field (past the limit they wrap and the backup can't be restored), and
 * the reader rejects ZIP64 anyway.
 */
export const MAX_BACKUP_BYTES = 0xffffffff;
const BACKUP_TOO_LARGE = 'This album is too large for one backup file, which can hold up to 4 GB.';

// What fflate's Zip writes around each stored entry's name and data, and after the last one.
const LOCAL_HEADER = 30;
const DATA_DESCRIPTOR = 16;
const DIRECTORY_RECORD = 46;
const END_OF_DIRECTORY = 22;

export async function exportToBackup(
  photos: PhotoEntry[],
  albumName: string,
  onProgress: ProgressCallback,
  cancel: CancelToken,
  /** The archive's size limit (tests lower it). */
  maxBytes: number = MAX_BACKUP_BYTES,
): Promise<{ filePath: string; exported: number; skipped: number }> {
  const localPhotos = photos.filter(p => isLocalFile(p.imageUri));
  const skipped = photos.length - localPhotos.length;
  if (localPhotos.length === 0) {
    const msg = skipped > 0
      ? `All ${skipped} photo${skipped !== 1 ? 's' : ''} are remote and cannot be exported.`
      : 'No local photos to export.';
    throw new Error(msg);
  }

  const exportDir = getExportDir();
  if (!exportDir.exists) {
    exportDir.create({ intermediates: true, idempotent: true });
  }

  const manifest = {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    album: albumName,
    photos: [] as BackupPhoto[],
  };

  // Streams the archive to disk one photo at a time. Building it in memory (base64 +
  // JSZip) took several times the album's size, which a year of photos (1+ GB) can't
  // survive. Entries are stored, not deflated: JPEGs don't compress.
  const outputFile = new File(exportDir, `rewind-backup-${Date.now()}.rewind`);
  let writeError: unknown = null;
  let written = 0;
  // The central directory closing the archive: a record per entry, then its end record.
  let directoryBytes = END_OF_DIRECTORY;
  const zip = new Zip((err, chunk) => {
    if (err) {
      writeError = err;
      return;
    }
    try {
      outputFile.write(chunk, { append: true });
      written += chunk.length;
    } catch (e) {
      writeError = e;
    }
  });
  const addEntry = (name: string, bytes: Uint8Array) => {
    const nameLength = strToU8(name).length;
    directoryBytes += DIRECTORY_RECORD + nameLength;
    // Stop before an entry that won't fit along with the directory written after it. For the
    // manifest, the last entry, this sum is the finished archive's exact size.
    if (written + LOCAL_HEADER + nameLength + bytes.length + DATA_DESCRIPTOR + directoryBytes > maxBytes) {
      throw new Error(BACKUP_TOO_LARGE);
    }
    const entry = new ZipPassThrough(name);
    zip.add(entry);
    entry.push(bytes, true);
    if (writeError) throw writeError;
  };

  try {
    outputFile.write(new Uint8Array(0));
    for (let i = 0; i < localPhotos.length; i++) {
      if (cancel.cancelled) throw new Error('Cancelled');
      const photo = localPhotos[i];
      const filename = `${photo.date}.jpg`;
      addEntry(`images/${filename}`, await new File(photo.imageUri).bytes());
      manifest.photos.push(backupPhoto(photo, `images/${filename}`));
      onProgress(i + 1, localPhotos.length + 1);
    }
    addEntry('manifest.json', strToU8(JSON.stringify(manifest, null, 2)));
    zip.end();
    if (writeError) throw writeError;
  } catch (e) {
    cleanupExportDir();
    throw e;
  }

  onProgress(localPhotos.length + 1, localPhotos.length + 1);
  return { filePath: outputFile.uri, exported: localPhotos.length, skipped };
}

export async function shareFile(filePath: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(filePath);
}

export { cleanupExportDir };
