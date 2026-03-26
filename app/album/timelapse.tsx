import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CaretLeft, Export } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { useAppContext } from '@/context/AppContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useTimelapse } from '@/hooks/useTimelapse';
import { haptics } from '@/utils/haptics';
import TimelapseView, { TimelapseEmpty } from '@/components/timelapse/TimelapseView';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';

export default function AlbumTimelapseScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const { albums } = useAppContext();
  const album = albums.find(a => a.id === albumId);
  const albumName = album?.name ?? albumId ?? 'album';

  const { fonts } = useFont();
  const { photos } = usePhotos(albumId);
  const timelapse = useTimelapse({ photos, exportName: albumName });

  function goBack() {
    haptics.tap();
    router.canGoBack() ? router.back() : router.replace('/');
  }

  if (timelapse.filteredPhotos.length < 2) {
    const message = timelapse.hasDateFilter
      ? 'No photos in this date range — try a wider range'
      : 'Take more photos to create your timelapse';
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: fonts.regular }]} numberOfLines={1}>{albumName}</Text>
          <View style={styles.headerRight} />
        </View>
        <TimelapseEmpty
          message={message}
          hasDateFilter={timelapse.hasDateFilter}
          onAdjustRange={() => timelapse.setShowDateRange(true)}
        />
        <DateRangeSheet
          visible={timelapse.showDateRange}
          dates={timelapse.allDates}
          startDate={timelapse.rangeStart}
          endDate={timelapse.rangeEnd}
          onApply={timelapse.handleDateRangeApply}
          onClose={() => timelapse.setShowDateRange(false)}
        />
      </SafeAreaView>
    );
  }

  const header = (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: fonts.regular }]} numberOfLines={1}>{albumName}</Text>
        <Pressable
          style={({ pressed }) => [styles.exportButton, pressed && { opacity: 0.7 }]}
          onPress={timelapse.handleExport}
          accessibilityLabel="Export timelapse"
          accessibilityRole="button"
        >
          <Export size={16} color={Colors.textPrimary} weight="light" />
          <Text style={[styles.exportLabel, { fontFamily: fonts.regular }]}>export</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TimelapseView header={header} timelapse={timelapse} speedSelectorStyle={{ paddingBottom: 8 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  exportLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textPrimary,
  },
});
