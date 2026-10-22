import { Alert } from 'react-native';
import { haptics } from '@/utils/haptics';

/**
 * Asks before deleting an album and its photos: the same words and haptics from every
 * screen that offers it. The last album can't be deleted.
 */
export function confirmDeleteAlbum(album: { name: string }, albumCount: number, onDelete: () => void): void {
  if (albumCount <= 1) {
    haptics.error();
    Alert.alert("Can't delete", 'You need at least one album.');
    return;
  }
  haptics.warning();
  Alert.alert('Delete album?', `"${album.name}" and all its photos will be deleted. This can't be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        onDelete();
        haptics.success();
      },
    },
  ]);
}
