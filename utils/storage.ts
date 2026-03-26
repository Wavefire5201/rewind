import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhotoEntry, UserProfile, AppSettings, Album } from '@/types';

const KEYS = {
  PHOTOS: '@rewind/photos',
  PROFILE: '@rewind/profile',
  SETTINGS: '@rewind/settings',
  ALBUMS: '@rewind/albums',
} as const;

export function getDefaultSettings(): AppSettings {
  return {
    photoQuality: 'high',
    cloudBackupEnabled: false,
    mirrorSelfies: true,
    fontFamily: 'jetbrains',
  };
}

export async function savePhotos(photos: PhotoEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.PHOTOS, JSON.stringify(photos));
}

export async function loadPhotos(): Promise<PhotoEntry[]> {
  const data = await AsyncStorage.getItem(KEYS.PHOTOS);
  return data ? JSON.parse(data) : [];
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export async function loadProfile(): Promise<UserProfile | null> {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!data) return getDefaultSettings();
  const stored = JSON.parse(data) as Partial<AppSettings>;
  return { ...getDefaultSettings(), ...stored };
}

export async function saveAlbums(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALBUMS, JSON.stringify(albums));
}

export async function loadAlbums(): Promise<Album[] | null> {
  const data = await AsyncStorage.getItem(KEYS.ALBUMS);
  return data ? JSON.parse(data) : null;
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.PHOTOS, KEYS.PROFILE, KEYS.SETTINGS, KEYS.ALBUMS]);
}
