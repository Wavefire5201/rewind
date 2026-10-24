import { useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { notifyCantSavePhotos } from '@/utils/photoNotices';

/**
 * A check to run before saving a new photo or starting an import. While the stored photos
 * couldn't be read (`photosLoadFailed`), new photos can't be saved without replacing them, so
 * it says so and returns false: nothing gets copied or added only to be dropped.
 */
export function useCanAddPhotos(): () => boolean {
  const { photosLoadFailed } = useAppContext();
  return useCallback(() => {
    if (!photosLoadFailed) return true;
    notifyCantSavePhotos();
    return false;
  }, [photosLoadFailed]);
}
