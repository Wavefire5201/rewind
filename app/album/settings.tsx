import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import PinModal, { PinIntent } from '@/components/ui/PinModal';
import { hasPin } from '@/utils/pin';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CaretLeft, PencilSimple, LockSimple, BellSimple, Export, DownloadSimple, Trash } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { useAppContext } from '@/context/AppContext';
import { haptics } from '@/utils/haptics';
import type { Album } from '@/types';
import { getToday } from '@/utils/dates';
import { requestNotificationPermission, syncAllReminders } from '@/utils/notifications';
import { pickPhotosFromLibrary, importFromBackup, createPhotoEntry } from '@/utils/import';
import { exportToPhotoAlbum, exportToBackup, shareFile, cleanupExportDir } from '@/utils/export';
import TextInputModal from '@/components/ui/TextInputModal';
import TimePicker from '@/components/ui/TimePicker';
import ExportSheet, { ExportFormat } from '@/components/timelapse/ExportSheet';
import ExportProgress from '@/components/timelapse/ExportProgress';
import ImportPhotoModal from '@/components/ImportPhotoModal';
import ImportSheet, { ImportSource } from '@/components/ui/ImportSheet';
import SectionLabel from '@/components/ui/SectionLabel';

export default function AlbumSettingsScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const { fonts, typography } = useFont();
  const { profile, albums, photos, settings, addPhotos, updateProfile, updateAlbum, deleteAlbum } = useAppContext();
  const album = albums.find(a => a.id === albumId);
  const albumPhotos = photos.filter(p => p.albumId === albumId);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinIntent, setPinIntent] = useState<PinIntent>('unlock');
  const [pendingLockAction, setPendingLockAction] = useState<'lock' | 'unlock' | null>(null);

  // Animated time picker expand/collapse
  const PICKER_HEIGHT = 225;
  const pickerHeight = useSharedValue(0);
  const pickerOpacity = useSharedValue(0);

  useEffect(() => {
    const config = { duration: 280, easing: Easing.out(Easing.cubic) };
    pickerHeight.value = withTiming(showTimePicker ? PICKER_HEIGHT : 0, config);
    pickerOpacity.value = withTiming(showTimePicker ? 1 : 0, { duration: showTimePicker ? 280 : 150 });
  }, [showTimePicker]);

  const pickerAnimatedStyle = useAnimatedStyle(() => ({
    height: pickerHeight.value,
    opacity: pickerOpacity.value,
    overflow: 'hidden' as const,
  }));
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLabel, setExportLabel] = useState('');
  const [exportCurrent, setExportCurrent] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const cancelRef = useRef({ cancelled: false });
  const [importPhotos, setImportPhotos] = useState<{ uri: string; suggestedDate: string }[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importCurrent, setImportCurrent] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const importCancelRef = useRef({ cancelled: false });

  if (!album) return null;

  const albumName = album.name;

  function goBack() {
    haptics.tap();
    router.canGoBack() ? router.back() : router.replace('/');
  }

  // --- Rename ---
  function handleConfirmRename(name: string) {
    setShowRenameModal(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    updateAlbum(albumId, { name: trimmed });
    haptics.success();
  }

  // --- Reminders ---
  async function handleReminderToggle() {
    haptics.tap();
    const current = albums.find(a => a.id === albumId);
    if (!current) return;
    const newEnabled = !current.reminderEnabled;
    if (newEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable notifications in Settings to use reminders.');
        return;
      }
    }
    updateAlbum(albumId, { reminderEnabled: newEnabled });
    const updatedAlbum: Album = { ...current, reminderEnabled: newEnabled };
    await syncAllReminders(albums.map(a => a.id === albumId ? updatedAlbum : a));
    if (!newEnabled) {
      setShowTimePicker(false);
      pickerHeight.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      pickerOpacity.value = withTiming(0, { duration: 150 });
    }
  }

  async function handleTimeChange(newTime: string) {
    const current = albums.find(a => a.id === albumId);
    if (!current) return;
    updateAlbum(albumId, { reminderTime: newTime });
    const updatedAlbum: Album = { ...current, reminderTime: newTime };
    await syncAllReminders(albums.map(a => a.id === albumId ? updatedAlbum : a));
  }

  function formatReminderTime(time: string): string {
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    if (settings.use24hClock) {
      return `${String(hour).padStart(2, '0')}:${minuteStr}`;
    }
    const period = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minuteStr} ${period}`;
  }

  // --- Export ---
  async function handleExportFormat(format: ExportFormat) {
    setShowExportSheet(false);
    cancelRef.current = { cancelled: false };

    if (format === 'album') {
      setExportLabel('saving to photo album...');
      setExportCurrent(0);
      setExportTotal(albumPhotos.length);
      setExporting(true);
      try {
        await exportToPhotoAlbum(
          albumPhotos,
          (current, total) => { setExportCurrent(current); setExportTotal(total); },
          cancelRef.current
        );
        setExporting(false);
        haptics.success();
        Alert.alert('Export Complete', `${albumPhotos.length} photos saved to your photo library.`);
      } catch (err: unknown) {
        setExporting(false);
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message !== 'Cancelled') { haptics.error(); Alert.alert('Export Failed', message); }
      }
    } else if (format === 'backup') {
      setExportLabel('creating backup...');
      setExportCurrent(0);
      setExportTotal(albumPhotos.length + 1);
      setExporting(true);
      try {
        const filePath = await exportToBackup(
          albumPhotos,
          albumName,
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

  // --- Import ---
  function handleImport() {
    haptics.tap();
    setShowImportSheet(true);
  }

  async function handleImportSource(source: ImportSource) {
    setShowImportSheet(false);
    if (source === 'camera-roll') {
      try {
        const picked = await pickPhotosFromLibrary();
        if (picked.length === 0) return;
        setImportPhotos(picked.map(p => ({ uri: p.uri, suggestedDate: p.date ?? getToday() })));
        setShowImportModal(true);
      } catch (e: unknown) {
        haptics.error();
        Alert.alert('Import Failed', e instanceof Error ? e.message : 'Unknown error');
      }
    } else if (source === 'backup') {
      importCancelRef.current = { cancelled: false };
      setImportCurrent(0);
      setImportTotal(0);
      setImporting(true);
      try {
        const entries = await importFromBackup(albumId, (current, total) => {
          setImportCurrent(current);
          setImportTotal(total);
        });
        setImporting(false);
        if (entries.length === 0) return;
        // I3/I4: single batch merge+dedup+sort, honest counts
        const { added, skipped } = addPhotos(entries);
        haptics.success();
        const msg = skipped > 0
          ? `${added} photo${added !== 1 ? 's' : ''} restored. ${skipped} skipped (already exist).`
          : `${added} photo${added !== 1 ? 's' : ''} restored from backup.`;
        Alert.alert('Import Complete', msg);
      } catch (e: unknown) {
        setImporting(false);
        haptics.error();
        Alert.alert('Import Failed', e instanceof Error ? e.message : 'Unknown error');
      }
    }
  }

  function handleImportSave(entries: { uri: string; date: string; caption: string }[]) {
    // I2: createPhotoEntry now throws on copy failure; collect only successful entries
    const photoEntries = [];
    let copyFailed = 0;
    for (const entry of entries) {
      try {
        photoEntries.push(createPhotoEntry(entry.uri, entry.date, entry.caption, albumId));
      } catch {
        copyFailed++;
      }
    }

    // I3/I4: batch add with single save; addPhotos owns dedup (no stale pre-check here)
    const { added, skipped } = addPhotos(photoEntries);

    // Update joinDate to earliest successfully imported date
    let earliestDate = profile.joinDate;
    for (const e of photoEntries) {
      if (e.date < earliestDate) earliestDate = e.date;
    }
    if (earliestDate < profile.joinDate) updateProfile({ joinDate: earliestDate });

    setShowImportModal(false);
    setImportPhotos([]);
    haptics.success();

    // I4: honest counts
    const parts: string[] = [];
    if (added > 0) parts.push(`${added} photo${added !== 1 ? 's' : ''} added`);
    if (skipped > 0) parts.push(`${skipped} skipped (already exist)`);
    if (copyFailed > 0) parts.push(`${copyFailed} failed to copy`);
    Alert.alert('Import Complete', parts.length > 0 ? parts.join(', ') + '.' : 'No photos imported.');
  }

  // --- PIN / Lock ---
  function handlePinSuccess() {
    setShowPinModal(false);
    if (pendingLockAction === 'lock') {
      updateAlbum(albumId, { isLocked: true });
    } else if (pendingLockAction === 'unlock') {
      updateAlbum(albumId, { isLocked: false });
    }
    setPendingLockAction(null);
  }

  // --- Delete ---
  function handleDelete() {
    haptics.tap();
    if (albums.length <= 1) {
      Alert.alert("Can't Delete", 'You need at least one album.');
      return;
    }
    Alert.alert(
      'Delete Album?',
      'This will permanently delete all photos in this album. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Album',
          style: 'destructive',
          onPress: () => {
            deleteAlbum(albumId);
            router.replace('/');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_right' }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.regular }]}>album settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ALBUM section */}
        <SectionLabel>album</SectionLabel>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => { haptics.tap(); setShowRenameModal(true); }}
            accessibilityLabel="Rename album"
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <PencilSimple size={20} color={Colors.textSecondary} weight="light" />
              <Text style={[typography.body, { fontFamily: fonts.regular }]}>rename</Text>
            </View>
            <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>{albumName} ›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={async () => {
              haptics.tap();
              if (album.isLocked) {
                setPendingLockAction('unlock');
                setPinIntent('unlock');
                setShowPinModal(true);
              } else {
                const pinExists = await hasPin();
                if (pinExists) {
                  updateAlbum(albumId, { isLocked: true });
                } else {
                  setPendingLockAction('lock');
                  setPinIntent('set');
                  setShowPinModal(true);
                }
              }
            }}
            accessibilityLabel={album.isLocked ? 'Unlock album' : 'Lock album'}
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <LockSimple
                size={20}
                color={album.isLocked ? Colors.streak : Colors.textSecondary}
                weight="light"
              />
              <Text style={[typography.body, { fontFamily: fonts.regular }]}>lock album</Text>
            </View>
            <Text style={[styles.rowValue, { fontFamily: fonts.regular, color: album.isLocked ? Colors.streak : Colors.textTertiary }]}>
              {album.isLocked ? 'on' : 'off'}
            </Text>
          </Pressable>
        </View>

        {/* REMINDERS section */}
        <SectionLabel style={{ marginTop: 24 }}>reminders</SectionLabel>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={handleReminderToggle}
            accessibilityLabel={album.reminderEnabled ? 'Disable daily reminder' : 'Enable daily reminder'}
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <BellSimple
                size={20}
                color={album.reminderEnabled ? Colors.streak : Colors.textSecondary}
                weight="light"
              />
              <Text style={[typography.body, { fontFamily: fonts.regular }]}>daily reminder</Text>
            </View>
            <Text style={[styles.rowValue, { fontFamily: fonts.regular, color: album.reminderEnabled ? Colors.streak : Colors.textTertiary }]}>
              {album.reminderEnabled ? 'on' : 'off'}
            </Text>
          </Pressable>

          {album.reminderEnabled && (
            <>
              <View style={styles.divider} />
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                onPress={() => { haptics.tap(); setShowTimePicker(prev => !prev); }}
                accessibilityLabel="Change reminder time"
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <View style={{ width: 20 }} />
                  <Text style={[typography.body, { fontFamily: fonts.regular, color: Colors.textSecondary }]}>reminder time</Text>
                </View>
                <Text style={[styles.rowValue, { fontFamily: fonts.regular, color: Colors.streak }]}>
                  {formatReminderTime(album.reminderTime)}
                </Text>
              </Pressable>

              <Animated.View style={[styles.pickerContainer, pickerAnimatedStyle]}>
                <TimePicker
                  value={album.reminderTime}
                  onChange={handleTimeChange}
                  use24h={settings.use24hClock}
                />
              </Animated.View>
            </>
          )}
        </View>

        {/* DATA section */}
        <SectionLabel style={{ marginTop: 24 }}>data</SectionLabel>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => { haptics.tap(); setShowExportSheet(true); }}
            accessibilityLabel="Export album"
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <Export size={20} color={Colors.textSecondary} weight="light" />
              <Text style={[typography.body, { fontFamily: fonts.regular }]}>export album</Text>
            </View>
            <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={handleImport}
            accessibilityLabel="Import photos"
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <DownloadSimple size={20} color={Colors.textSecondary} weight="light" />
              <Text style={[typography.body, { fontFamily: fonts.regular }]}>import photos</Text>
            </View>
            <Text style={[styles.rowValue, { fontFamily: fonts.regular }]}>›</Text>
          </Pressable>
        </View>

        {/* Delete (only if more than 1 album) */}
        {albums.length > 1 && (
          <>
            <View style={{ marginTop: 24 }} />
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                onPress={handleDelete}
                accessibilityLabel="Delete album"
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <Trash size={20} color={Colors.danger} weight="light" />
                  <Text style={[typography.body, { fontFamily: fonts.regular, color: Colors.danger }]}>delete album</Text>
                </View>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <TextInputModal
        visible={showRenameModal}
        title="Rename Album"
        message="Enter a new name"
        placeholder="Album name"
        defaultValue={albumName}
        confirmLabel="Rename"
        onConfirm={handleConfirmRename}
        onCancel={() => setShowRenameModal(false)}
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
        onCancel={() => { cancelRef.current.cancelled = true; haptics.tap(); }}
      />

      <ExportProgress
        visible={importing}
        label="restoring from backup..."
        current={importCurrent}
        total={importTotal}
        onCancel={() => { importCancelRef.current.cancelled = true; haptics.tap(); }}
      />

      <ImportPhotoModal
        visible={showImportModal}
        photos={importPhotos}
        onSave={handleImportSave}
        onCancel={() => { setShowImportModal(false); setImportPhotos([]); }}
      />

      <ImportSheet
        visible={showImportSheet}
        onSelect={handleImportSource}
        onClose={() => setShowImportSheet(false)}
      />

      <PinModal
        visible={showPinModal}
        intent={pinIntent}
        onSuccess={handlePinSuccess}
        onCancel={() => { setShowPinModal(false); setPendingLockAction(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  card: {
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowValue: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
  },
  pickerContainer: {
  },
});
