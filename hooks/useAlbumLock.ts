import { useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';

export function useAlbumLock() {
  const { albums, unlockedAlbumIds, unlockAlbum } = useAppContext();

  const isAlbumLocked = useCallback(
    (albumId: string) => {
      const album = albums.find(a => a.id === albumId);
      return album?.isLocked === true && !unlockedAlbumIds.has(albumId);
    },
    [albums, unlockedAlbumIds],
  );

  return { isAlbumLocked, unlockAlbum };
}
