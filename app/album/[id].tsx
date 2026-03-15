import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import { useAppContext } from '@/context/AppContext';
import MonthHeader from '@/components/timeline/MonthHeader';
import CalendarStats from '@/components/timeline/CalendarStats';
import CalendarGrid from '@/components/timeline/CalendarGrid';
import PhotoModal from '@/components/timeline/PhotoModal';
import type { PhotoEntry } from '@/types';

export default function AlbumDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const { photos, getPhotosByMonth, getPhotoByDate } = usePhotos();
  const { profile } = useAppContext();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  function handleDayPress(date: string) {
    const photo = getPhotoByDate(date);
    if (photo) {
      setSelectedPhoto(photo);
      setModalVisible(true);
    }
  }

  const albumName = name ?? id ?? 'album';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: Colors.bgPage } }} />
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={12} style={styles.backBtn}>
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={styles.title}>{albumName}</Text>
        <View style={styles.backBtn} />
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
        photo={selectedPhoto}
        onClose={() => {
          setModalVisible(false);
          setSelectedPhoto(null);
        }}
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
