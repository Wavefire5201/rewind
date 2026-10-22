import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAppContext } from '@/context/AppContext';
import { haptics } from '@/utils/haptics';

/**
 * A check to run before saving a new photo or starting an import. While the stored photos
 * couldn't be read (`photosLoadFailed`), new photos can't be saved without replacing them, so
 * it says so and returns false: nothing gets copied or added only to be dropped.
 */
export function useCanAddPhotos(): () => boolean {
  const { photosLoadFailed } = useAppContext();
  return useCallback(() => {
    if (!photosLoadFailed) return true;
    haptics.error();
    Alert.alert(
      "Can't save photos",
      "Rewind couldn't read your saved photos, so it can't save new ones without overwriting them. Try restarting the app.",
    );
    return false;
  }, [photosLoadFailed]);
}
