import type { Album } from '@/types';

/** The longest album name, wherever one is entered (onboarding, new album, rename). */
export const ALBUM_NAME_MAX_LENGTH = 50;

export function createAlbum(name: string, overrides?: Partial<Album>): Album {
  return {
    id: `album-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: new Date().toISOString(),
    reminderEnabled: false,
    reminderTime: '08:00',
    isLocked: false,
    ...overrides,
  };
}
