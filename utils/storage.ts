import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PhotoEntry, UserProfile, AppSettings } from '@/types';

const KEYS = {
  PHOTOS: '@rewind/photos',
  PROFILE: '@rewind/profile',
  SETTINGS: '@rewind/settings',
} as const;

export function getDefaultSettings(): AppSettings {
  return {
    reminderEnabled: true,
    reminderTime: '08:00',
    photoQuality: 'high',
    cloudBackupEnabled: false,
    mirrorSelfies: true,
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
