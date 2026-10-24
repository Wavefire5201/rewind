import { Alert } from 'react-native';
import { haptics } from '@/utils/haptics';
import { confirm } from '@/utils/confirm';

/**
 * Asks before deleting an album and its photos: the same words and haptics from every
 * screen that offers it. The last album can't be deleted.
 */
export async function confirmDeleteAlbum(album: { name: string }, albumCount: number, onDelete: () => void): Promise<void> {
  if (albumCount <= 1) {
    haptics.error();
    Alert.alert("Can't delete", 'You need at least one album.');
    return;
  }
  haptics.tap();
  const yes = await confirm({
    title: 'delete album?',
    message: `"${album.name}" and all its photos will be deleted. this can't be undone.`,
    confirmLabel: 'delete',
    destructive: true,
  });
  if (!yes) return;
  onDelete();
  haptics.success();
}
