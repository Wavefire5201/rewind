import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import JSZip from 'jszip';
import type { PhotoEntry } from '@/types';
import { getToday } from '@/utils/dates';

export async function pickPhotosFromLibrary(): Promise<{ uri: string; date: string | null }[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
    exif: true,
  });
  if (result.canceled) return [];
  return result.assets.map(asset => ({
    uri: asset.uri,
    date: asset.exif?.DateTimeOriginal
      ? (() => {
          try {
            // EXIF format: "YYYY:MM:DD HH:MM:SS"
            const raw = String(asset.exif.DateTimeOriginal);
            const datePart = raw.split(' ')[0].replace(/:/g, '-');
            return datePart; // YYYY-MM-DD
          } catch { return getToday(); }
        })()
      : getToday(),
  }));
}

export async function importFromBackup(): Promise<PhotoEntry[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  const srcFile = new File(result.assets[0].uri);
  const content = await srcFile.base64();
  const zip = await JSZip.loadAsync(content, { base64: true });
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Invalid backup: no manifest.json found');
  const manifest = JSON.parse(await manifestFile.async('string'));
  const photos: PhotoEntry[] = [];
  for (const entry of manifest.photos) {
    const imageFile = zip.file(entry.imageFile);
    if (!imageFile) continue;
    const imageBase64 = await imageFile.async('base64');
    const filename = `rewind_import_${Date.now()}_${entry.date}.jpg`;
    const destFile = new File(Paths.document, filename);
    destFile.write(imageBase64, { encoding: 'base64' });
    photos.push({
      id: `import_${Date.now()}_${entry.date}`,
      date: entry.date,
      imageUri: destFile.uri,
      caption: entry.caption || '',
      capturedAt: new Date().toISOString(),
      cameraDirection: 'front',
    });
  }
  return photos;
}

export function createPhotoEntry(uri: string, date: string, caption: string = ''): PhotoEntry {
  const filename = `rewind_import_${Date.now()}.jpg`;
  try {
    const src = new File(uri);
    const dest = new File(Paths.document, filename);
    src.copy(dest);
    return {
      id: `import_${Date.now()}_${date}`,
      date, imageUri: dest.uri, caption,
      capturedAt: new Date().toISOString(),
      cameraDirection: 'front',
    };
  } catch {
    return {
      id: `import_${Date.now()}_${date}`,
      date, imageUri: uri, caption,
      capturedAt: new Date().toISOString(),
      cameraDirection: 'front',
    };
  }
}
