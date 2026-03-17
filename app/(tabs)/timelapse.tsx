import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Export, Camera, CalendarBlank } from 'phosphor-react-native';
import { Colors, Typography, Fonts } from '@/constants/theme';
import TimelapsePlayer, { TimelapsePlayerHandle } from '@/components/timelapse/TimelapsePlayer';
import Scrubber from '@/components/timelapse/Scrubber';
import Filmstrip from '@/components/timelapse/Filmstrip';
import SpeedSelector from '@/components/timelapse/SpeedSelector';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
import ExportSheet, { ExportFormat } from '@/components/timelapse/ExportSheet';
import ExportProgress from '@/components/timelapse/ExportProgress';
import { exportToPhotoAlbum, exportToBackup, shareFile, cleanupExportDir } from '@/utils/export';
import { haptics } from '@/utils/haptics';
import { usePhotos } from '@/hooks/usePhotos';

function formatMMDD(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

export default function TimelapseScreen() {
  const { photos } = usePhotos();
  const [speed, setSpeed] = useState(1);
  const [displayIndex, setDisplayIndex] = useState(0);
  const playerRef = useRef<TimelapsePlayerHandle>(null);

  // Date range state
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [showDateRange, setShowDateRange] = useState(false);

  // Export state
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLabel, setExportLabel] = useState('');
  const [exportCurrent, setExportCurrent] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const cancelRef = useRef({ cancelled: false });

  // Derived data
  const allDates = photos.map((p) => p.date).sort();
  const rangeStart = dateRange?.start ?? (allDates[0] ?? '');
  const rangeEnd = dateRange?.end ?? (allDates[allDates.length - 1] ?? '');

  const filteredPhotos = dateRange
    ? photos.filter((p) => p.date >= dateRange.start && p.date <= dateRange.end)
    : photos;

  const handleFrameChange = useCallback((index: number) => {
    setDisplayIndex(index);
  }, []);

  const handlePlaybackEnd = useCallback((index: number) => {
    setDisplayIndex(index);
  }, []);

  const handleSeek = useCallback((index: number) => {
    setDisplayIndex(index);
    playerRef.current?.seekTo(index);
  }, []);

  const handleFilmstripSelect = useCallback((index: number) => {
    setDisplayIndex(index);
    playerRef.current?.seekTo(index);
  }, []);

  const handleSpeedSelect = useCallback((s: number) => setSpeed(s), []);

  function handleExport() {
    haptics.tap();
    setShowExportSheet(true);
  }

  async function handleExportFormat(format: ExportFormat) {
    setShowExportSheet(false);

    cancelRef.current = { cancelled: false };

    if (format === 'album') {
      setExportLabel('Saving to Photo Album...');
      setExportCurrent(0);
      setExportTotal(filteredPhotos.length);
      setExporting(true);
      try {
        await exportToPhotoAlbum(
          filteredPhotos,
          (current, total) => {
            setExportCurrent(current);
            setExportTotal(total);
          },
          cancelRef.current
        );
        setExporting(false);
        haptics.success();
        Alert.alert('Done', `${filteredPhotos.length} photos saved to the Rewind album.`);
      } catch (err: unknown) {
        setExporting(false);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message !== 'Cancelled') {
          haptics.error();
          Alert.alert('Export Failed', message);
        }
      }
    } else if (format === 'backup') {
      setExportLabel('Creating Rewind Backup...');
      setExportCurrent(0);
      setExportTotal(filteredPhotos.length + 1);
      setExporting(true);
      try {
        const filePath = await exportToBackup(
          filteredPhotos,
          'Rewind',
          (current, total) => {
            setExportCurrent(current);
            setExportTotal(total);
          },
          cancelRef.current
        );
        setExporting(false);
        haptics.success();
        await shareFile(filePath);
        await cleanupExportDir();
      } catch (err: unknown) {
        setExporting(false);
        await cleanupExportDir();
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message !== 'Cancelled') {
          haptics.error();
          Alert.alert('Export Failed', message);
        }
      }
    }
  }

  function handleCancelExport() {
    cancelRef.current.cancelled = true;
    haptics.tap();
  }

  function handleDateRangeApply(start: string, end: string) {
    const isAll = start === allDates[0] && end === allDates[allDates.length - 1];
    setDateRange(isAll ? null : { start, end });
    setShowDateRange(false);
    setDisplayIndex(0);
    playerRef.current?.seekTo(0);
  }

  const hasDateFilter = dateRange !== null;

  if (filteredPhotos.length < 2) {
    const message = hasDateFilter
      ? 'No photos in this date range — try a wider range'
      : 'Take more photos to create your timelapse';
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Camera size={48} color={Colors.textTertiary} weight="light" />
          <Text style={styles.emptyText}>{message}</Text>
          {hasDateFilter && (
            <TouchableOpacity onPress={() => setShowDateRange(true)} activeOpacity={0.7}>
              <Text style={styles.emptyLink}>adjust range</Text>
            </TouchableOpacity>
          )}
        </View>
        <DateRangeSheet
          visible={showDateRange}
          dates={allDates}
          startDate={rangeStart}
          endDate={rangeEnd}
          onApply={handleDateRangeApply}
          onClose={() => setShowDateRange(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={Typography.displayTitle}>timelapse</Text>
          <TouchableOpacity style={styles.exportButton} onPress={handleExport} activeOpacity={0.7}>
            <Export size={16} color={Colors.textPrimary} weight="light" />
            <Text style={styles.exportLabel}>export</Text>
          </TouchableOpacity>
        </View>

        {/* Date range row */}
        <TouchableOpacity
          style={[styles.dateRangeRow, hasDateFilter && styles.dateRangeRowActive]}
          onPress={() => { haptics.tap(); setShowDateRange(true); }}
          activeOpacity={0.7}
        >
          <CalendarBlank
            size={14}
            color={hasDateFilter ? Colors.accent : Colors.textTertiary}
            weight="light"
          />
          <Text style={[styles.dateRangeText, hasDateFilter && styles.dateRangeTextActive]}>
            {formatMMDD(rangeStart)}  —  {formatMMDD(rangeEnd)}
          </Text>
        </TouchableOpacity>

        {/* Player fills remaining space */}
        <TimelapsePlayer
          ref={playerRef}
          photos={filteredPhotos}
          speed={speed}
          onFrameChange={handleFrameChange}
          onPlaybackEnd={handlePlaybackEnd}
        />

        {/* Controls grouped at bottom — fixed height */}
        <View style={styles.controls}>
          <Scrubber
            currentIndex={displayIndex}
            total={filteredPhotos.length}
            startDate={filteredPhotos[0].date}
            endDate={filteredPhotos[filteredPhotos.length - 1].date}
            onSeek={handleSeek}
          />
          <Filmstrip
            photos={filteredPhotos}
            currentIndex={displayIndex}
            onSelect={handleFilmstripSelect}
          />
          <SpeedSelector selectedSpeed={speed} onSelect={handleSpeedSelect} />
        </View>
      </View>

      <DateRangeSheet
        visible={showDateRange}
        dates={allDates}
        startDate={rangeStart}
        endDate={rangeEnd}
        onApply={handleDateRangeApply}
        onClose={() => setShowDateRange(false)}
      />

      <ExportSheet
        visible={showExportSheet}
        onSelect={handleExportFormat}
        onClose={() => setShowExportSheet(false)}
      />

      <ExportProgress
        visible={exporting}
        label={exportLabel}
        current={exportCurrent}
        total={exportTotal}
        onCancel={handleCancelExport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 84,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  dateRangeRowActive: {},
  dateRangeText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  dateRangeTextActive: {
    color: Colors.accent,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  exportLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textPrimary,
  },
  controls: {
    gap: 8,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 28,
  },
  emptyText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  emptyLink: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
});
