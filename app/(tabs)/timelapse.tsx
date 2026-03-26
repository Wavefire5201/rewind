import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Export } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { useAppContext } from '@/context/AppContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useTimelapse } from '@/hooks/useTimelapse';
import { haptics } from '@/utils/haptics';
import TimelapseView, { TimelapseEmpty } from '@/components/timelapse/TimelapseView';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';

export default function TimelapseScreen() {
  const { fonts, typography } = useFont();
  const { albums } = useAppContext();
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(albums[0]?.id ?? 'daily-selfie');
  const { photos: allPhotos } = usePhotos();
  const photos = allPhotos.filter(p => p.albumId === selectedAlbumId);

  const timelapse = useTimelapse({ photos, exportName: 'Rewind' });

  if (timelapse.filteredPhotos.length < 2) {
    const message = timelapse.hasDateFilter
      ? 'No photos in this date range — try a wider range'
      : 'Take more photos to create your timelapse';
    return (
      <SafeAreaView style={styles.safeArea}>
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
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={typography.displayTitle}>timelapse</Text>
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

      {/* Album selector */}
      {albums.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.albumSelectorScroll}
          contentContainerStyle={styles.albumSelectorContent}
        >
          {albums.map((album) => {
            const isSelected = album.id === selectedAlbumId;
            return (
              <Pressable
                key={album.id}
                style={({ pressed }) => [styles.albumPill, isSelected && styles.albumPillActive, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  haptics.tap();
                  setSelectedAlbumId(album.id);
                  timelapse.resetForAlbum();
                }}
                accessibilityLabel={`${album.name}${isSelected ? ', selected' : ''}`}
                accessibilityRole="button"
              >
                <Text style={[styles.albumPillText, isSelected && styles.albumPillTextActive, { fontFamily: fonts.regular }]}>
                  {album.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <TimelapseView header={header} timelapse={timelapse} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 16,
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
  albumSelectorScroll: {
    marginBottom: 8,
  },
  albumSelectorContent: {
    gap: 8,
    paddingVertical: 4,
  },
  albumPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  albumPillActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(143, 166, 122, 0.12)',
  },
  albumPillText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  albumPillTextActive: {
    color: Colors.accent,
  },
});
