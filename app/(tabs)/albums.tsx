import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInputModal from '@/components/ui/TextInputModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, CaretRight, Camera, PencilSimple } from 'phosphor-react-native';
import { haptics } from '@/utils/haptics';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import EmptyState from '@/components/ui/EmptyState';
import { createAlbum } from '@/utils/albums';
import type { Album } from '@/types';

export default function AlbumsScreen() {
  const router = useRouter();
  const { photos, albums, addAlbum, updateAlbum } = useAppContext();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const renameTargetRef = useRef<Album | null>(null);

  // Derive a global mostRecentPhoto for the empty-state check
  const mostRecentPhoto = photos.length > 0
    ? [...photos].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  function handleCreateAlbum() {
    haptics.tap();
    setShowCreateModal(true);
  }

  function handleConfirmCreate(name: string) {
    setShowCreateModal(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    addAlbum(createAlbum(trimmed));
    haptics.success();
  }

  function handleRenameAlbum(album: Album) {
    haptics.tap();
    renameTargetRef.current = album;
    setShowRenameModal(true);
  }

  function handleConfirmRename(name: string) {
    setShowRenameModal(false);
    const trimmed = name.trim();
    if (!trimmed || !renameTargetRef.current) return;
    updateAlbum(renameTargetRef.current.id, { name: trimmed });
    haptics.success();
    renameTargetRef.current = null;
  }

  // Check if user has any real photos
  if (!mostRecentPhoto) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>albums</Text>
        </View>
        <EmptyState
          icon={<Camera size={48} color={Colors.textTertiary} weight="light" />}
          message="No albums yet. Take your first photo to get started."
          ctaLabel="Open Camera"
          onCta={() => router.push('/(tabs)/camera')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>albums</Text>
          <TouchableOpacity style={styles.addButton} activeOpacity={0.7} onPress={handleCreateAlbum}>
            <Plus size={18} color={Colors.textSecondary} weight="regular" />
          </TouchableOpacity>
        </View>

        <View style={styles.list}>
          {albums.map((album, index) => {
            const albumPhotos = photos.filter(p => p.albumId === album.id);
            const photoCount = albumPhotos.length;
            const albumMostRecent = albumPhotos.length > 0
              ? [...albumPhotos].sort((a, b) => b.date.localeCompare(a.date))[0]
              : null;
            const imageUri = albumMostRecent?.imageUri ?? null;

            return (
              <React.Fragment key={album.id}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => { haptics.tap(); router.push({ pathname: '/album/[id]', params: { id: album.id } }); }}
                >
                  <View style={styles.thumbnail}>
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.thumbnailImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.thumbnailPlaceholder} />
                    )}
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.albumName}>{album.name}</Text>
                    <Text style={styles.meta}>
                      {photoCount} photos
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { haptics.tap(); router.push({ pathname: '/(tabs)/camera', params: { albumId: album.id } }); }}
                    hitSlop={12}
                    style={styles.cameraBtn}
                    activeOpacity={0.7}
                  >
                    <Camera size={16} color={Colors.textTertiary} weight="regular" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRenameAlbum(album)}
                    hitSlop={12}
                    style={styles.editBtn}
                    activeOpacity={0.7}
                  >
                    <PencilSimple size={14} color={Colors.textTertiary} weight="regular" />
                  </TouchableOpacity>
                  <CaretRight size={16} color={Colors.textTertiary} weight="regular" />
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>

      <TextInputModal
        visible={showCreateModal}
        title="New Album"
        message="Enter a name for the album"
        placeholder="Album name"
        confirmLabel="Create"
        onConfirm={handleConfirmCreate}
        onCancel={() => setShowCreateModal(false)}
      />
      <TextInputModal
        visible={showRenameModal}
        title="Rename Album"
        message="Enter a new name"
        placeholder="Album name"
        defaultValue={renameTargetRef.current?.name ?? ''}
        confirmLabel="Rename"
        onConfirm={handleConfirmRename}
        onCancel={() => setShowRenameModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    ...Typography.displayTitle,
  },
  addButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {},
  divider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  thumbnail: {
    width: 56,
    height: 56,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 56,
    height: 56,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    backgroundColor: Colors.bgCard,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  albumName: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  meta: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textTertiary,
  },
  cameraBtn: {
    padding: 8,
  },
  editBtn: {
    padding: 8,
  },
});
