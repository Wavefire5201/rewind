import type { Album } from '@/types';

export function createAlbum(name: string, overrides?: Partial<Album>): Album {
  return {
    id: `album-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: new Date().toISOString(),
    reminderEnabled: false,
    reminderTime: '08:00',
    ...overrides,
  };
}
