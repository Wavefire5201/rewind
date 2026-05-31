import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import TextInputModal from '@/components/ui/TextInputModal';
import PinModal from '@/components/ui/PinModal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Plus, CaretRight, Camera, GearSix, LockSimple } from 'phosphor-react-native';
import { Colors, Fonts, Sizes, Typography } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { useFont } from '@/context/FontContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useStreak } from '@/hooks/useStreak';
import { useGreeting } from '@/hooks/useGreeting';
import { useAlbumLock } from '@/hooks/useAlbumLock';
import { haptics } from '@/utils/haptics';
import { getImageSource } from '@/utils/imageSource';
import { createAlbum } from '@/utils/albums';
import type { Album } from '@/types';

// ─── HeroCard ───────────────────────────────────────────────────────────────

function HeroCard({
  albumId,
  albumName,
  albumCreatedAt,
  onUnlockRequest,
}: {
  albumId: string;
  albumName: string;
  albumCreatedAt: string;
  onUnlockRequest?: (albumId: string) => void;
}) {
  const router = useRouter();
  const { todayPhoto } = usePhotos(albumId);
  const { currentStreak, weekStatus } = useStreak(albumId, albumCreatedAt);
  const { fonts, typography } = useFont();
  const { isAlbumLocked } = useAlbumLock();
  const locked = isAlbumLocked(albumId);

  function handlePress() {
    haptics.tap();
    if (locked) {
      onUnlockRequest?.(albumId);
      return;
    }
    router.push({ pathname: '/album/[id]', params: { id: albumId } });
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.heroCard, pressed && { opacity: 0.8 }]}
      onPress={handlePress}
      accessibilityLabel={`${albumName} album`}
      accessibilityRole="button"
    >
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
          <LockSimple size={36} color={Colors.textTertiary} weight="light" />
          <Text style={[styles.heroEmptyText, { fontFamily: fonts.regular }]}>locked</Text>
        </View>
      ) : todayPhoto ? (
        <Image
          source={getImageSource(todayPhoto.imageUri)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
          <Camera size={36} color={Colors.textTertiary} weight="light" />
          <Text style={[styles.heroEmptyText, { fontFamily: fonts.regular }]}>take today's photo</Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={styles.heroGradient}
      />

      <View style={styles.heroOverlay}>
        <View style={styles.heroOverlayTop}>
          <View style={styles.heroOverlayLeft}>
            <Text style={[styles.heroAlbumName, { fontFamily: fonts.regular }]} numberOfLines={1}>{albumName}</Text>
            {!locked && (
              <Text style={[typography.small, { color: Colors.streak }]}>
                {currentStreak > 0 ? `${currentStreak} day streak` : 'no streak yet'}
              </Text>
            )}
          </View>
          <CaretRight size={16} color={Colors.textTertiary} weight="regular" />
        </View>
        {!locked && (
          <View style={styles.weekRow}>
            {weekStatus.map((wd) => (
              <View key={wd.date} style={styles.weekDayCol}>
                <View
                  accessibilityLabel={`${wd.date}: ${wd.status}`}
                  style={[
                    styles.weekDot,
                    (wd.status === 'captured' || wd.status === 'today-done') && styles.weekDotFilled,
                    wd.status === 'today-pending' && styles.weekDotToday,
                    (wd.status === 'disabled' || wd.status === 'upcoming') && styles.weekDotDim,
                  ]}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── AlbumRow ────────────────────────────────────────────────────────────────

function AlbumRow({ album, onUnlockRequest }: { album: Album; onUnlockRequest?: (albumId: string) => void }) {
  const router = useRouter();
  const { totalPhotos, mostRecentPhoto } = usePhotos(album.id);
  const { currentStreak } = useStreak(album.id, album.createdAt);
  const imageUri = mostRecentPhoto?.imageUri ?? null;
  const { fonts, typography } = useFont();
  const { isAlbumLocked } = useAlbumLock();
  const locked = isAlbumLocked(album.id);

  function handlePress() {
    haptics.tap();
    if (locked) {
      onUnlockRequest?.(album.id);
      return;
    }
    router.push({ pathname: '/album/[id]', params: { id: album.id } });
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={handlePress}
      accessibilityLabel={`${album.name} album`}
      accessibilityRole="button"
    >
      <View style={styles.thumbnail}>
        {locked ? (
          <View style={[styles.thumbnailPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
            <LockSimple size={20} color={Colors.textTertiary} weight="light" />
          </View>
        ) : imageUri ? (
          <Image
            source={getImageSource(imageUri)}
            style={styles.thumbnailImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={typography.body} numberOfLines={1}>{album.name}</Text>
        <Text style={[typography.small, { color: Colors.textTertiary }]}>
          {locked ? 'locked' : currentStreak > 0 ? `${currentStreak} day streak` : `${totalPhotos} photos`}
        </Text>
      </View>
      <CaretRight size={16} color={Colors.textTertiary} weight="regular" />
    </Pressable>
  );
}

// ─── HomeScreen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { albums, isLoading, addAlbum } = useAppContext();
  const { greeting, dayNumber } = useGreeting();
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [unlockTargetId, setUnlockTargetId] = useState<string | null>(null);
  const { fonts, typography } = useFont();
  const { unlockAlbum } = useAlbumLock();

  function handleUnlockRequest(albumId: string) {
    setUnlockTargetId(albumId);
    setShowPinModal(true);
  }

  function handlePinSuccess() {
    setShowPinModal(false);
    if (unlockTargetId) {
      unlockAlbum(unlockTargetId);
      router.push({ pathname: '/album/[id]', params: { id: unlockTargetId } });
      setUnlockTargetId(null);
    }
  }

  useEffect(() => {
    if (!isLoading && albums.length === 0) {
      router.replace('/onboarding');
    }
  }, [isLoading, albums.length, router]);

  function handleCreateAlbum() {
    haptics.tap();
    setShowNewAlbumModal(true);
  }

  function handleConfirmNewAlbum(name: string) {
    setShowNewAlbumModal(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    addAlbum(createAlbum(trimmed));
    haptics.success();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.content, { paddingHorizontal: 28 }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.skeletonGreeting} />
              <View style={styles.skeletonDay} />
            </View>
          </View>
          <View style={styles.skeletonHero} />
        </View>
      </SafeAreaView>
    );
  }

  if (albums.length === 0) {
    return null;
  }

  const [heroAlbum, ...restAlbums] = albums;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { fontFamily: fonts.regular }]}>{greeting}</Text>
            <Text style={typography.small}>day {dayNumber}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.gearBtn, pressed && { opacity: 0.7 }]}
            onPress={() => { haptics.tap(); router.push('/(tabs)/profile'); }}
            hitSlop={12}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <GearSix size={20} color={Colors.textPrimary} weight="regular" />
          </Pressable>
        </View>

        {/* Hero card */}
        <HeroCard
          albumId={heroAlbum.id}
          albumName={heroAlbum.name}
          albumCreatedAt={heroAlbum.createdAt}
          onUnlockRequest={handleUnlockRequest}
        />

        {/* Album list */}
        {restAlbums.length > 0 && (
          <View style={styles.list}>
            {restAlbums.map((album, index) => (
              <React.Fragment key={album.id}>
                {index > 0 && <View style={styles.divider} />}
                <AlbumRow album={album} onUnlockRequest={handleUnlockRequest} />
              </React.Fragment>
            ))}
          </View>
        )}

        {/* New album button */}
        <Pressable
          style={({ pressed }) => [styles.newAlbumRow, pressed && { opacity: 0.7 }]}
          onPress={handleCreateAlbum}
          accessibilityLabel="Create new album"
          accessibilityRole="button"
        >
          <View style={styles.newAlbumIcon}>
            <Plus size={20} color={Colors.accent} weight="regular" />
          </View>
          <Text style={[styles.newAlbumText, { fontFamily: fonts.regular }]}>new album</Text>
        </Pressable>
      </ScrollView>
      <TextInputModal
        visible={showNewAlbumModal}
        title="New Album"
        message="Enter a name for the album"
        placeholder="Album name"
        confirmLabel="Create"
        onConfirm={handleConfirmNewAlbum}
        onCancel={() => setShowNewAlbumModal(false)}
      />
      <PinModal
        visible={showPinModal}
        intent="unlock"
        onSuccess={handlePinSuccess}
        onCancel={() => { setShowPinModal(false); setUnlockTargetId(null); }}
        onNoPinFound={() => {
          // PIN data gone — auto-clear the lock and navigate in
          if (unlockTargetId) {
            unlockAlbum(unlockTargetId);
            router.push({ pathname: '/album/[id]', params: { id: unlockTargetId } });
            setUnlockTargetId(null);
          }
          setShowPinModal(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerLeft: {
    gap: 2,
  },
  gearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontFamily: Fonts.mono.regular,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -1,
    color: Colors.textPrimary,
  },

  // Hero card
  heroCard: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroEmptyText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textTertiary,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  heroOverlay: {
    padding: 16,
    gap: 8,
  },
  heroOverlayTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroOverlayLeft: {
    gap: 2,
  },
  heroAlbumName: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  weekDayCol: {
    alignItems: 'center',
  },
  weekDot: {
    width: Sizes.weekDot,
    height: Sizes.weekDot,
    borderRadius: Sizes.weekDot / 2,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  weekDotFilled: {
    backgroundColor: Colors.streak,
    borderColor: Colors.streak,
  },
  weekDotToday: {
    borderColor: Colors.streak,
    backgroundColor: 'transparent',
  },
  weekDotDim: {
    opacity: 0.3,
  },

  // Album list
  list: {
    marginTop: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  thumbnail: {
    width: 48,
    height: 48,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 48,
    height: 48,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: Colors.bgCard,
  },
  rowInfo: {
    flex: 1,
    gap: 3,
  },

  // Skeleton
  skeletonGreeting: {
    width: 160,
    height: 28,
    backgroundColor: Colors.bgCard,
  },
  skeletonDay: {
    width: 60,
    height: 12,
    backgroundColor: Colors.bgCard,
    marginTop: 4,
  },
  skeletonHero: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.bgCard,
  },

  // New album button
  newAlbumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
  },
  newAlbumIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newAlbumText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.accent,
  },

});
