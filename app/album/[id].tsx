import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CaretLeft, DownloadSimple, Camera, BellSimple, Play } from 'phosphor-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useStreak } from '@/hooks/useStreak';
import { useAppContext } from '@/context/AppContext';
import { pickPhotosFromLibrary, importFromBackup, createPhotoEntry } from '@/utils/import';
import { haptics } from '@/utils/haptics';
import { getToday } from '@/utils/dates';
import { requestNotificationPermission, syncAllReminders } from '@/utils/notifications';
import MonthHeader from '@/components/timeline/MonthHeader';
import CalendarStats from '@/components/timeline/CalendarStats';
import CalendarGrid from '@/components/timeline/CalendarGrid';
import PhotoModal from '@/components/timeline/PhotoModal';
import ImportPhotoModal from '@/components/ImportPhotoModal';
import SectionLabel from '@/components/ui/SectionLabel';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { photos, todayPhoto, mostRecentPhoto, getPhotosByMonth } = usePhotos(id);
  const { profile, albums, addPhoto, updatePhoto, deletePhoto, updateProfile, updateAlbum, deleteAlbum } = useAppContext();
  const album = albums.find(a => a.id === id);
  const { currentStreak, consistency } = useStreak(id, album?.createdAt);

  const { fonts, typography } = useFont();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [importPhotos, setImportPhotos] = useState<{ uri: string; suggestedDate: string }[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);

  const monthPhotos = getPhotosByMonth(currentMonth.year, currentMonth.month);
  const captured = monthPhotos.length;
  const today = new Date();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month, 0).getDate();
  const daysPassed = currentMonth.year === today.getFullYear() && currentMonth.month === today.getMonth() + 1
    ? today.getDate()
    : currentMonth.year < today.getFullYear() || (currentMonth.year === today.getFullYear() && currentMonth.month < today.getMonth() + 1)
      ? daysInMonth
      : 0;
  const missed = Math.max(0, daysPassed - captured);

  function handlePrevMonth() {
    setCurrentMonth(prev => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function handleNextMonth() {
    setCurrentMonth(prev => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  async function handleImport() {
    haptics.tap();
    Alert.alert('Import Photos', 'Choose import source', [
      {
        text: 'Camera Roll',
        onPress: async () => {
          try {
            const picked = await pickPhotosFromLibrary();
            if (picked.length === 0) return;
            setImportPhotos(picked.map(p => ({ uri: p.uri, suggestedDate: p.date ?? getToday() })));
            setShowImportModal(true);
          } catch (e: unknown) {
            haptics.error();
            Alert.alert('Import Failed', e instanceof Error ? e.message : 'Unknown error');
          }
        },
      },
      {
        text: 'Rewind Backup',
        onPress: async () => {
          try {
            const entries = await importFromBackup(id);
            if (entries.length === 0) return;
            for (const entry of entries) {
              const existing = photos.find(p => p.date === entry.date);
              if (existing) continue;
              addPhoto(entry);
            }
            haptics.success();
            Alert.alert('Import Complete', `${entries.length} photos restored from backup.`);
          } catch (e: unknown) {
            haptics.error();
            Alert.alert('Import Failed', e instanceof Error ? e.message : 'Unknown error');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleImportSave(entries: { uri: string; date: string; caption: string }[]) {
    let earliestDate = profile.joinDate;
    for (const entry of entries) {
      const existing = photos.find(p => p.date === entry.date);
      if (existing) continue;
      const photoEntry = createPhotoEntry(entry.uri, entry.date, entry.caption, id);
      addPhoto(photoEntry);
      if (entry.date < earliestDate) {
        earliestDate = entry.date;
      }
    }
    if (earliestDate < profile.joinDate) {
      updateProfile({ joinDate: earliestDate });
    }
    setShowImportModal(false);
    setImportPhotos([]);
    haptics.success();
    Alert.alert('Import Complete', `${entries.length} photo${entries.length !== 1 ? 's' : ''} added to this album.`);
  }

  function formatReminderTime(time: string): string {
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minuteStr} ${period}`;
  }

  function getReminderTimeAsDate(timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  async function handleReminderToggle() {
    if (!album) return;
    haptics.tap();
    const newEnabled = !album.reminderEnabled;
    if (newEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable notifications in Settings to use reminders.');
        return;
      }
    }
    const updatedAlbum = { ...album, reminderEnabled: newEnabled };
    updateAlbum(id, { reminderEnabled: newEnabled });
    await syncAllReminders(albums.map(a => a.id === id ? updatedAlbum : a));
  }

  async function handleReminderTimeChange(_event: unknown, selectedDate?: Date) {
    if (Platform.OS === 'android') setShowReminderTimePicker(false);
    if (!selectedDate || !album) return;
    const hh = String(selectedDate.getHours()).padStart(2, '0');
    const mm = String(selectedDate.getMinutes()).padStart(2, '0');
    const newTime = `${hh}:${mm}`;
    const updatedAlbum = { ...album, reminderTime: newTime };
    updateAlbum(id, { reminderTime: newTime });
    await syncAllReminders(albums.map(a => a.id === id ? updatedAlbum : a));
  }

  function handleDayPress(date: string) {
    const index = monthPhotos.findIndex(p => p.date === date);
    if (index >= 0) {
      setSelectedPhotoIndex(index);
      setModalVisible(true);
    }
  }

  const albumName = album?.name ?? id ?? 'album';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: Colors.bgPage }, animation: 'slide_from_right' }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptics.tap(); router.canGoBack() ? router.back() : router.replace('/'); }}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.regular }]} numberOfLines={1}>{albumName}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleImport}
            hitSlop={12}
            style={styles.headerBtn}
            accessibilityLabel="Import photos"
            accessibilityRole="button"
          >
            <DownloadSimple size={20} color={Colors.textPrimary} weight="regular" />
          </Pressable>
          {photos.length >= 2 && (
            <Pressable
              onPress={() => { haptics.tap(); router.push({ pathname: '/album/timelapse', params: { albumId: id } }); }}
              hitSlop={12}
              style={styles.headerBtn}
              accessibilityLabel="Play timelapse"
              accessibilityRole="button"
            >
              <Play size={20} color={Colors.textPrimary} weight="regular" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Today section */}
        {todayPhoto ? (
          <View style={styles.todayRow}>
            <Image
              source={{ uri: todayPhoto.imageUri }}
              style={styles.todayThumb}
              contentFit="cover"
            />
            <View style={styles.todayInfo}>
              <Text style={[styles.todayCaptured, { fontFamily: fonts.regular }]}>captured today</Text>
              {todayPhoto.caption ? (
                <Text style={typography.small} numberOfLines={1}>{todayPhoto.caption}</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={[styles.todayPrompt, { fontFamily: fonts.regular }]}>you haven't captured today</Text>
        )}

        {/* Album stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { fontFamily: fonts.light }]}>{photos.length}</Text>
            <Text style={typography.small}>photos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { fontFamily: fonts.light, color: Colors.streak }]}>{currentStreak}</Text>
            <Text style={typography.small}>day streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { fontFamily: fonts.light }]}>{consistency}%</Text>
            <Text style={typography.small}>consistency</Text>
          </View>
        </View>

        <MonthHeader
          year={currentMonth.year}
          month={currentMonth.month}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
          onTitlePress={() => setShowMonthPicker(prev => !prev)}
        />
        {showMonthPicker && (
          <DateTimePicker
            value={new Date(currentMonth.year, currentMonth.month - 1, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_e, selected) => {
              if (Platform.OS === 'android') setShowMonthPicker(false);
              if (selected) {
                setCurrentMonth({ year: selected.getFullYear(), month: selected.getMonth() + 1 });
              }
            }}
            themeVariant="dark"
            maximumDate={new Date()}
          />
        )}
        <CalendarStats captured={captured} missed={missed} />
        <CalendarGrid
          year={currentMonth.year}
          month={currentMonth.month}
          photos={photos}
          joinDate={album?.createdAt ? album.createdAt.split('T')[0] : profile.joinDate}
          onDayPress={handleDayPress}
        />

        {/* Reminder settings */}
        <View>
          <SectionLabel>reminders</SectionLabel>
          <View style={styles.settingsCard}>
            <Pressable
              style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.7 }]}
              onPress={handleReminderToggle}
              accessibilityLabel={album?.reminderEnabled ? 'Disable daily reminder' : 'Enable daily reminder'}
              accessibilityRole="button"
            >
              <View style={styles.settingsLeft}>
                <BellSimple
                  size={20}
                  color={album?.reminderEnabled ? Colors.accent : Colors.textSecondary}
                  weight="light"
                />
                <Text style={typography.body}>daily reminder</Text>
              </View>
              <Text style={[styles.settingsValue, { fontFamily: fonts.regular }]}>
                {album?.reminderEnabled ? formatReminderTime(album.reminderTime) : 'Off'}
              </Text>
            </Pressable>

            {album?.reminderEnabled && (
              <View>
                <View style={styles.settingsDivider} />
                <Pressable
                  style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.7 }]}
                  onPress={() => { haptics.tap(); setShowReminderTimePicker(prev => !prev); }}
                  accessibilityLabel="Change reminder time"
                  accessibilityRole="button"
                >
                  <View style={styles.settingsLeft}>
                    <Text style={typography.body}>reminder time</Text>
                  </View>
                  <Text style={[styles.settingsValue, { fontFamily: fonts.regular, color: Colors.accent }]}>
                    {formatReminderTime(album.reminderTime)}
                  </Text>
                </Pressable>
                {showReminderTimePicker && (
                  <DateTimePicker
                    value={getReminderTimeAsDate(album.reminderTime)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleReminderTimeChange}
                    themeVariant="dark"
                    minuteInterval={5}
                  />
                )}
              </View>
            )}
          </View>
        </View>

        {/* Delete album */}
        {albums.length > 1 && (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
            onPress={() => {
              haptics.tap();
              Alert.alert(
                'Delete Album?',
                'This will permanently delete all photos in this album.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      deleteAlbum(id);
                      router.replace('/');
                    },
                  },
                ],
              );
            }}
            accessibilityLabel="Delete album"
            accessibilityRole="button"
          >
            <Text style={[styles.deleteBtnText, { fontFamily: fonts.regular }]}>delete album</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Floating capture button */}
      <Pressable
        onPress={() => { haptics.tap(); router.push({ pathname: '/(tabs)/camera', params: { albumId: id } }); }}
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        accessibilityLabel="Take photo"
        accessibilityRole="button"
      >
        <Camera size={24} color={Colors.bgPage} weight="regular" />
      </Pressable>

      <PhotoModal
        visible={modalVisible}
        photos={monthPhotos}
        initialIndex={selectedPhotoIndex}
        joinDate={profile.joinDate}
        onClose={() => setModalVisible(false)}
        onDelete={(id) => { deletePhoto(id); if (monthPhotos.length <= 1) setModalVisible(false); }}
        onUpdateCaption={(id, caption) => updatePhoto(id, { caption })}
      />

      <ImportPhotoModal
        visible={showImportModal}
        photos={importPhotos}
        onSave={handleImportSave}
        onCancel={() => { setShowImportModal(false); setImportPhotos([]); }}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
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
    gap: 24,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayThumb: {
    width: 48,
    height: 48,
  },
  todayInfo: {
    flex: 1,
    gap: 2,
  },
  todayCaptured: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  todayPrompt: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.streak,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: Fonts.mono.light,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -1,
    color: Colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    right: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsCard: {
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsValue: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: Colors.borderDivider,
    width: '100%',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  deleteBtnText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.danger,
  },
});
