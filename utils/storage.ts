import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhotoEntry, UserProfile, AppSettings, Album } from '@/types';

const KEYS = {
  PHOTOS: '@rewind/photos',
  // A photos value that failed to parse, set aside before anything could save over it.
  PHOTOS_CORRUPT_BACKUP: '@rewind/photos-corrupt-backup',
  PROFILE: '@rewind/profile',
  SETTINGS: '@rewind/settings',
  ALBUMS: '@rewind/albums',
  UNLOCKED_ALBUMS: '@rewind/unlocked-albums',
} as const;

export function getDefaultSettings(): AppSettings {
  return {
    photoQuality: 'high',
    cloudBackupEnabled: false,
    mirrorSelfies: true,
    use24hClock: false,
    alignFaces: true,
  };
}

export async function savePhotos(photos: PhotoEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.PHOTOS, JSON.stringify(photos));
}

/**
 * Loads every photo. Nothing stored gives [].
 *
 * Rejects when the stored value can't be read (on Android, a row bigger than the 2 MB cursor
 * window fails to read even though it saved). That is not "no photos": the caller must not
 * save photos after it, since a save replaces the whole stored array.
 *
 * A corrupt value (not JSON, or not an array) gives [] as before, but only once it's copied to
 * a backup key, so the next save doesn't destroy it. The first backup is kept: it holds the
 * photos from before the reset, a later one only photos taken since. If the copy can't be
 * written, this rejects like a failed read.
 */
export async function loadPhotos(): Promise<PhotoEntry[]> {
  const data = await AsyncStorage.getItem(KEYS.PHOTOS);
  if (!data) return [];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(data);
  } catch {}
  if (Array.isArray(parsed)) return parsed;
  console.error('loadPhotos: corrupt JSON, backing it up and resetting to []');
  // getAllKeys, not getItem: an old backup may be too big to read back.
  if (!(await AsyncStorage.getAllKeys()).includes(KEYS.PHOTOS_CORRUPT_BACKUP)) {
    await AsyncStorage.setItem(KEYS.PHOTOS_CORRUPT_BACKUP, data);
  }
  return [];
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export async function loadProfile(): Promise<UserProfile | null> {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    console.error('loadProfile: corrupt JSON, resetting to null');
    return null;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!data) return getDefaultSettings();
  try {
    const stored = JSON.parse(data) as Partial<AppSettings>;
    return { ...getDefaultSettings(), ...stored };
  } catch {
    console.error('loadSettings: corrupt JSON, resetting to defaults');
    return getDefaultSettings();
  }
}

export async function saveAlbums(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALBUMS, JSON.stringify(albums));
}

export async function loadAlbums(): Promise<Album[] | null> {
  const data = await AsyncStorage.getItem(KEYS.ALBUMS);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    console.error('loadAlbums: corrupt JSON, resetting to null');
    return null;
  }
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.PHOTOS, KEYS.PHOTOS_CORRUPT_BACKUP, KEYS.PROFILE, KEYS.SETTINGS, KEYS.ALBUMS, KEYS.UNLOCKED_ALBUMS]);
}

// Album unlocks used to be saved here, which kept a locked album open across restarts.
// They now live only in memory; this removes what older versions left behind.
export async function clearUnlockedAlbumIds(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.UNLOCKED_ALBUMS);
}
