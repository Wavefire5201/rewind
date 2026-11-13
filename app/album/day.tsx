import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { useAppContext } from '@/context/AppContext';
import AlbumLockGate from '@/components/ui/AlbumLockGate';
import DayPage from '@/components/day/DayPage';
import { trackingStartDate } from '@/utils/streak';
import { clampDay, dayRange } from '@/utils/days';
import { setLastViewedDay } from '@/utils/lastViewedDay';
import { unitFor } from '@/utils/weight';
import { buildFaceTrend, photoReadout } from '@/utils/faceTrend';
import { isFaceScanAvailable } from '@/utils/faceScan';
import { pickPhotosFromLibrary, createPhotoEntry } from '@/utils/import';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';
import { haptics } from '@/utils/haptics';
import type { PhotoEntry, WeightEntry, WeightValue } from '@/types';

type DayParams = { albumId: string; date?: string; focus?: string };

export default function DayRoute() {
  const { albumId } = useLocalSearchParams<DayParams>();
  return (
    <AlbumLockGate albumId={albumId}>
      <DayScreen />
    </AlbumLockGate>
  );
}

/**
 * Every day of an album, one full-screen page each, from the album's start through today. Opens
 * on the day it was given; swiping moves a day at a time, including days without a photo.
 */
function DayScreen() {
  const { albumId, date: dateParam, focus } = useLocalSearchParams<DayParams>();
  const router = useRouter();
  const { fonts } = useFont();
  const { width, height } = useWindowDimensions();
  const {
    albums, photos: allPhotos, weights: allWeights, profile, settings, today,
    addPhoto, deletePhoto, updatePhoto, setWeight, deleteWeight,
  } = useAppContext();
  const album = albums.find(a => a.id === albumId);
  const photos = useMemo(() => allPhotos.filter(p => p.albumId === albumId), [allPhotos, albumId]);
  const weights = useMemo(() => allWeights.filter(w => w.albumId === albumId), [allWeights, albumId]);
  const photoByDate = useMemo(() => new Map<string, PhotoEntry>(photos.map(p => [p.date, p])), [photos]);
  const weightByDate = useMemo(() => new Map<string, WeightEntry>(weights.map(w => [w.date, w])), [weights]);
  const unit = unitFor(settings.units);

  // The days are fixed while the view is open, so deleting the earliest photo (or midnight
  // passing) can't pull the page out from under you. They update on the next open.
  const [{ days, initialIndex }] = useState(() => {
    const start = trackingStartDate(album?.createdAt, profile.joinDate, photos.map(p => p.date), weights.map(w => w.date));
    const range = dayRange(start, today);
    return { days: range, initialIndex: Math.max(0, range.indexOf(clampDay(dateParam, start, today))) };
  });
  const lastIndex = days.length - 1;

  const faceAvailable = isFaceScanAvailable();
  const trend = useMemo(() => (faceAvailable ? buildFaceTrend(photos) : null), [faceAvailable, photos]);

  const photoHeight = Math.min(width * (4 / 3), height * 0.55);

  const currentIndex = useRef(initialIndex);
  useEffect(() => {
    setLastViewedDay(albumId, days[initialIndex]);
  }, [albumId, days, initialIndex]);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.min(lastIndex, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (index === currentIndex.current) return;
    currentIndex.current = index;
    setLastViewedDay(albumId, days[index]);
  }, [albumId, days, lastIndex, width]);

  async function addFromLibrary(date: string) {
    try {
      const [picked] = await pickPhotosFromLibrary({ multiple: false });
      if (!picked) return;
      // On this day whatever the photo's own date; a replaced photo's caption carries over.
      const entry = await createPhotoEntry(picked.uri, date, photoByDate.get(date)?.caption ?? '', albumId);
      addPhoto(entry);
      haptics.success();
    } catch {
      notify({ title: "couldn't add the photo", tone: 'error' });
    }
  }

  async function removePhoto(photo: PhotoEntry) {
    const yes = await confirm({
      title: 'delete photo?',
      message: 'this photo will be permanently deleted.',
      confirmLabel: 'delete',
      destructive: true,
    });
    if (!yes) return;
    deletePhoto(photo.id);
    haptics.success();
  }

  async function share(photo: PhotoEntry) {
    try {
      const { shareAsync } = await import('expo-sharing');
      await shareAsync(photo.imageUri);
    } catch (e) {
      console.warn('Share failed:', e);
    }
  }

  function saveWeight(date: string, weight: WeightValue | null) {
    if (weight) void setWeight(albumId, date, weight);
    else void deleteWeight(albumId, date);
  }

  const renderItem = ({ item: date, index }: { item: string; index: number }) => {
    const photo = photoByDate.get(date) ?? null;
    return (
      <DayPage
        date={date}
        dayNumber={index + 1}
        isToday={date === today}
        photo={photo}
        weight={weightByDate.get(date)}
        unit={unit}
        readout={faceAvailable && photo ? photoReadout(trend, photo) : null}
        use24h={settings.use24hClock}
        width={width}
        photoHeight={photoHeight}
        focusWeight={focus === 'weight' && index === initialIndex}
        onTakePhoto={() => router.push({ pathname: '/(tabs)/camera', params: { albumId } })}
        onAddFromLibrary={() => { void addFromLibrary(date); }}
        onShare={() => { if (photo) void share(photo); }}
        onDelete={() => { if (photo) void removePhoto(photo); }}
        onCaption={(caption) => { if (photo) updatePhoto(photo.id, { caption }); }}
        onWeight={(weight) => saveWeight(date, weight)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: Colors.bgPage } }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptics.tap(); if (router.canGoBack()) router.back(); else router.replace('/'); }}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <CaretLeft size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.regular }]} numberOfLines={1}>{album?.name ?? ''}</Text>
        <View style={styles.headerBtn} />
      </View>
      <FlatList
        testID="day-pager"
        data={days}
        keyExtractor={(d) => d}
        renderItem={renderItem}
        extraData={[photoByDate, weightByDate, trend, unit, settings.use24hClock]}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        // A few pages either side: a 1,000-day album pages without mounting every photo.
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={2}
        // Swiping drops the keyboard first, so a typed weight saves (the field commits on blur).
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={onScrollEnd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: Fonts.mono.regular, fontSize: 14, color: Colors.textPrimary },
});
