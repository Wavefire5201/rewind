import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CaretLeft, DownloadSimple } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import { useAppContext } from '@/context/AppContext';
import { pickPhotosFromLibrary, importFromBackup, createPhotoEntry } from '@/utils/import';
import { haptics } from '@/utils/haptics';
import { getToday } from '@/utils/dates';
import MonthHeader from '@/components/timeline/MonthHeader';
import CalendarStats from '@/components/timeline/CalendarStats';
import CalendarGrid from '@/components/timeline/CalendarGrid';
import PhotoModal from '@/components/timeline/PhotoModal';
import ImportPhotoModal from '@/components/ImportPhotoModal';

export default function AlbumDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const { photos, getPhotosByMonth } = usePhotos();
  const { profile, addPhoto, updatePhoto, deletePhoto } = useAppContext();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [importPhotos, setImportPhotos] = useState<{ uri: string; suggestedDate: string }[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

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
          } catch (e: any) {
            haptics.error();
            Alert.alert('Import Failed', e.message);
          }
        },
      },
      {
        text: 'Rewind Backup',
        onPress: async () => {
          try {
            const entries = await importFromBackup();
            if (entries.length === 0) return;
            for (const entry of entries) {
              const existing = photos.find(p => p.date === entry.date);
              if (existing) continue;
              addPhoto(entry);
            }
            haptics.success();
            Alert.alert('Imported', `${entries.length} photos restored from backup.`);
          } catch (e: any) {
            haptics.error();
            Alert.alert('Import Failed', e.message);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleImportSave(entries: { uri: string; date: string; caption: string }[]) {
    for (const entry of entries) {
      const existing = photos.find(p => p.date === entry.date);
      if (existing) continue;
      const photoEntry = createPhotoEntry(entry.uri, entry.date, entry.caption);
      addPhoto(photoEntry);
    }
    setShowImportModal(false);
    setImportPhotos([]);
    haptics.success();
    Alert.alert('Imported', `${entries.length} photo${entries.length !== 1 ? 's' : ''} imported.`);
  }

  function handleDayPress(date: string) {
    const index = monthPhotos.findIndex(p => p.date === date);
    if (index >= 0) {
      setSelectedPhotoIndex(index);
      setModalVisible(true);
    }
  }

  const albumName = name ?? id ?? 'album';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: Colors.bgPage }, animation: 'slide_from_right' }} />
      <View style={styles.header}>
        <Pressable onPress={() => { haptics.tap(); router.back(); }} hitSlop={12} style={styles.backBtn}>
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={styles.title}>{albumName}</Text>
        <Pressable onPress={handleImport} hitSlop={12} style={styles.backBtn}>
          <DownloadSimple size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MonthHeader
          year={currentMonth.year}
          month={currentMonth.month}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
        />
        <CalendarStats captured={captured} missed={missed} />
        <CalendarGrid
          year={currentMonth.year}
          month={currentMonth.month}
          photos={photos}
          joinDate={profile.joinDate}
          onDayPress={handleDayPress}
        />
      </ScrollView>

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
  title: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 24,
  },
});
