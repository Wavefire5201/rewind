import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, CaretRight, Camera } from 'phosphor-react-native';
import { haptics } from '@/utils/haptics';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import EmptyState from '@/components/ui/EmptyState';

const STATIC_ALBUMS = [
  {
    id: 'workspace',
    name: 'workspace',
    photoCount: 45,
    streak: 32,
    imageUri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&h=200&fit=crop',
  },
  {
    id: 'plant-growth',
    name: 'plant growth',
    photoCount: 89,
    streak: 89,
    imageUri: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=200&h=200&fit=crop',
  },
];

export default function AlbumsScreen() {
  const router = useRouter();
  const { mostRecentPhoto } = usePhotos();

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

  const albums = [
    {
      id: 'daily-selfie',
      name: 'daily selfie',
      photoCount: 127,
      streak: 127,
      imageUri: mostRecentPhoto?.imageUri ?? null,
    },
    ...STATIC_ALBUMS,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>albums</Text>
          <TouchableOpacity style={styles.addButton} activeOpacity={0.7} onPress={() => { haptics.tap(); Alert.alert('Coming Soon', 'Custom album creation will be available in a future update.'); }}>
            <Plus size={18} color={Colors.textSecondary} weight="regular" />
          </TouchableOpacity>
        </View>

        <View style={styles.list}>
          {albums.map((album, index) => (
            <React.Fragment key={album.id}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => { haptics.tap(); router.push({ pathname: '/album/[id]', params: { id: album.id, name: album.name } }); }}>
                <View style={styles.thumbnail}>
                  {album.imageUri ? (
                    <Image
                      source={{ uri: album.imageUri }}
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
                    {album.photoCount} photos · {album.streak}d streak
                  </Text>
                </View>
                <CaretRight size={16} color={Colors.textTertiary} weight="regular" />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
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
});
