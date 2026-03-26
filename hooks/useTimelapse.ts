import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import type { PhotoEntry } from '@/types';
import { TimelapsePlayerHandle } from '@/components/timelapse/TimelapsePlayer';
import { ExportFormat } from '@/components/timelapse/ExportSheet';
import { exportToPhotoAlbum, exportToBackup, shareFile, cleanupExportDir } from '@/utils/export';
import { haptics } from '@/utils/haptics';

export function formatMMDD(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

interface UseTimelapseOptions {
  photos: PhotoEntry[];
  exportName: string;
}

export function useTimelapse({ photos, exportName }: UseTimelapseOptions) {
  const [speed, setSpeed] = useState(1);
  const [displayIndex, setDisplayIndex] = useState(0);
  const playerRef = useRef<TimelapsePlayerHandle>(null);

  // Date range
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [showDateRange, setShowDateRange] = useState(false);

  // Export
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLabel, setExportLabel] = useState('');
  const [exportCurrent, setExportCurrent] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const cancelRef = useRef({ cancelled: false });

  // Derived
  const allDates = photos.map((p) => p.date).sort();
  const rangeStart = dateRange?.start ?? (allDates[0] ?? '');
  const rangeEnd = dateRange?.end ?? (allDates[allDates.length - 1] ?? '');
  const filteredPhotos = dateRange
    ? photos.filter((p) => p.date >= dateRange.start && p.date <= dateRange.end)
    : photos;
  const hasDateFilter = dateRange !== null;

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
      setExportLabel('saving to photo album...');
      setExportCurrent(0);
      setExportTotal(filteredPhotos.length);
      setExporting(true);
      try {
        await exportToPhotoAlbum(
          filteredPhotos,
          (current, total) => { setExportCurrent(current); setExportTotal(total); },
          cancelRef.current
        );
        setExporting(false);
        haptics.success();
        Alert.alert('Export Complete', `${filteredPhotos.length} photos saved to your photo library.`);
      } catch (err: unknown) {
        setExporting(false);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message !== 'Cancelled') { haptics.error(); Alert.alert('Export Failed', message); }
      }
    } else if (format === 'backup') {
      setExportLabel('creating backup...');
      setExportCurrent(0);
      setExportTotal(filteredPhotos.length + 1);
      setExporting(true);
      try {
        const filePath = await exportToBackup(
          filteredPhotos,
          exportName,
          (current, total) => { setExportCurrent(current); setExportTotal(total); },
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
        if (message !== 'Cancelled') { haptics.error(); Alert.alert('Export Failed', message); }
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

  function resetForAlbum() {
    setDateRange(null);
    setDisplayIndex(0);
    playerRef.current?.seekTo(0);
  }

  return {
    playerRef,
    speed,
    displayIndex,
    filteredPhotos,
    allDates,
    rangeStart,
    rangeEnd,
    hasDateFilter,
    showDateRange,
    setShowDateRange,
    showExportSheet,
    setShowExportSheet,
    exporting,
    exportLabel,
    exportCurrent,
    exportTotal,
    handleFrameChange,
    handlePlaybackEnd,
    handleSeek,
    handleFilmstripSelect,
    handleSpeedSelect,
    handleExport,
    handleExportFormat,
    handleCancelExport,
    handleDateRangeApply,
    resetForAlbum,
  };
}
