import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { CaretLeft, Camera, Play, GearSix } from 'phosphor-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import MonthPicker from '@/components/ui/MonthPicker';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useStreak } from '@/hooks/useStreak';
import { useAppContext } from '@/context/AppContext';
import { haptics } from '@/utils/haptics';
import MonthHeader from '@/components/timeline/MonthHeader';
import CalendarStats from '@/components/timeline/CalendarStats';
import CalendarGrid from '@/components/timeline/CalendarGrid';
import PhotoModal from '@/components/timeline/PhotoModal';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { photos, getPhotosByMonth } = usePhotos(id);
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Animated month picker expand/collapse
  const MONTH_PICKER_HEIGHT = 224;
  const monthPickerHeight = useSharedValue(0);
  const monthPickerOpacity = useSharedValue(0);

  function toggleMonthPicker() {
    const next = !showMonthPicker;
    setShowMonthPicker(next);
    const config = { duration: 280, easing: Easing.out(Easing.cubic) };
    monthPickerHeight.value = withTiming(next ? MONTH_PICKER_HEIGHT : 0, config);
    monthPickerOpacity.value = withTiming(next ? 1 : 0, { duration: next ? 280 : 150 });
  }

  const monthPickerAnimatedStyle = useAnimatedStyle(() => ({
    height: monthPickerHeight.value,
    opacity: monthPickerOpacity.value,
    overflow: 'hidden' as const,
  }));

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

  const now = new Date();
  const joinYear = new Date(profile.joinDate).getFullYear();
  const joinMonth = new Date(profile.joinDate).getMonth() + 1;

  function handlePrevMonth() {
    setCurrentMonth(prev => {
      const prevTotal = prev.year * 12 + prev.month;
      const minTotal = joinYear * 12 + joinMonth;
      if (prevTotal <= minTotal) return prev;
      if (prev.month === 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function handleNextMonth() {
    setCurrentMonth(prev => {
      const prevTotal = prev.year * 12 + prev.month;
      const maxTotal = now.getFullYear() * 12 + (now.getMonth() + 1);
      if (prevTotal >= maxTotal) return prev;
      if (prev.month === 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: prev.month + 1 };
    });
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
        <Pressable
          onPress={() => { haptics.tap(); router.push({ pathname: '/album/settings', params: { albumId: id } }); }}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel="Album settings"
          accessibilityRole="button"
        >
          <GearSix size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
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
          onTitlePress={toggleMonthPicker}
          disableNext={currentMonth.year * 12 + currentMonth.month >= now.getFullYear() * 12 + (now.getMonth() + 1)}
          disablePrev={currentMonth.year * 12 + currentMonth.month <= joinYear * 12 + joinMonth}
        />
        <Animated.View style={monthPickerAnimatedStyle}>
          <MonthPicker
            year={currentMonth.year}
            month={currentMonth.month}
            onChange={(year, month) => setCurrentMonth({ year, month })}
            minYear={joinYear}
            minMonth={joinMonth}
            maxYear={now.getFullYear()}
            maxMonth={now.getMonth() + 1}
          />
        </Animated.View>
        <CalendarStats captured={captured} missed={missed} />
        <CalendarGrid
          year={currentMonth.year}
          month={currentMonth.month}
          photos={photos}
          joinDate={album?.createdAt ? album.createdAt.split('T')[0] : profile.joinDate}
          onDayPress={handleDayPress}
        />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {photos.length >= 2 && (
          <Pressable
            style={({ pressed }) => [styles.timelapseBtn, pressed && { opacity: 0.7 }]}
            onPress={() => { haptics.tap(); router.push({ pathname: '/album/timelapse', params: { albumId: id } }); }}
            accessibilityLabel="Play timelapse"
            accessibilityRole="button"
          >
            <Play size={14} color={Colors.textSecondary} weight="fill" />
            <Text style={[styles.timelapseBtnText, { fontFamily: fonts.regular }]}>timelapse</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.85 }]}
          onPress={() => { haptics.tap(); router.push({ pathname: '/(tabs)/camera', params: { albumId: id } }); }}
          accessibilityLabel="Take photo"
          accessibilityRole="button"
        >
          <Camera size={18} color={Colors.bgPage} weight="regular" />
          <Text style={[styles.captureBtnText, { fontFamily: fonts.medium }]}>capture</Text>
        </Pressable>
      </View>

      <PhotoModal
        visible={modalVisible}
        photos={monthPhotos}
        initialIndex={selectedPhotoIndex}
        joinDate={profile.joinDate}
        onClose={() => setModalVisible(false)}
        onDelete={(id) => { deletePhoto(id); if (monthPhotos.length <= 1) setModalVisible(false); }}
        onUpdateCaption={(id, caption) => updatePhoto(id, { caption })}
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
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 28,
    paddingTop: 12,
    backgroundColor: Colors.bgPage,
  },
  timelapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  timelapseBtnText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  captureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  captureBtnText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
    color: Colors.bgPage,
    letterSpacing: 1,
  },
});
