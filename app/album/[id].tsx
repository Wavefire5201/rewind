import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useIsFocused, useFocusEffect, Stack } from 'expo-router';
import { CaretLeft, Camera, Play, GearSix } from 'phosphor-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import MonthPicker from '@/components/ui/MonthPicker';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { usePhotos } from '@/hooks/usePhotos';
import { trackingStartDate } from '@/utils/streak';
import { useStreak } from '@/hooks/useStreak';
import { useAppContext } from '@/context/AppContext';
import { usePhotoEncodeBackfill } from '@/hooks/usePhotoEncodeBackfill';
import { useFaceScanBackfill } from '@/hooks/useFaceScanBackfill';
import { useThumbnailBackfill } from '@/hooks/useThumbnailBackfill';
import { isFaceScanAvailable, needsFaceScan } from '@/utils/faceScan';
import { buildFaceTrend } from '@/utils/faceTrend';
import TrendCard from '@/components/timeline/TrendCard';
import { unitFor } from '@/utils/weight';
import { haptics } from '@/utils/haptics';
import { takeLastViewedDay } from '@/utils/lastViewedDay';
import { nounFor } from '@/utils/text';
import MonthHeader from '@/components/timeline/MonthHeader';
import CalendarStats from '@/components/timeline/CalendarStats';
import CalendarGrid from '@/components/timeline/CalendarGrid';
import AlbumLockGate from '@/components/ui/AlbumLockGate';

export default function AlbumDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AlbumLockGate albumId={id}>
      <AlbumDetailScreen />
    </AlbumLockGate>
  );
}

function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { photos, getPhotosByMonth } = usePhotos(id);
  const { profile, albums, weights: allWeights, settings, today: todayDate } = useAppContext();
  const album = albums.find(a => a.id === id);
  const weights = useMemo(() => allWeights.filter(w => w.albumId === id), [allWeights, id]);
  const weightDates = useMemo(() => new Set(weights.map(w => w.date)), [weights]);
  const unit = unitFor(settings.units);
  const { currentStreak, consistency } = useStreak(id, album?.createdAt);

  const { fonts, typography } = useFont();

  const focused = useIsFocused();
  // Store photos as q95 (fresh captures and imports land here right after saving). Only
  // while this screen is in front, so playback and the camera get the CPU.
  const encode = usePhotoEncodeBackfill(photos, focused);
  // Face measurements for the trend card. Waits for the q95 pass: a scan reading a file the
  // encoder has just replaced would fail for this session.
  const faceAvailable = isFaceScanAvailable();
  const faceProgress = useFaceScanBackfill(photos, faceAvailable && focused && !encode.pending);
  // Small copies for the calendar, filmstrip and album rows; made from the q95 files.
  useThumbnailBackfill(photos, focused && !encode.pending);
  const faceTrend = useMemo(() => (faceAvailable ? buildFaceTrend(photos) : null), [faceAvailable, photos]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Back from the day view: show the month of the last day it showed.
  useFocusEffect(useCallback(() => {
    const date = takeLastViewedDay(id);
    if (!date) return;
    const [year, month] = date.split('-').map(Number);
    setCurrentMonth({ year, month });
  }, [id]));

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
  // A2: captured = distinct dates within [album start, today]
  const captured = new Set(monthPhotos.map(p => p.date)).size;
  const today = new Date();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month, 0).getDate();
  // The album's history starts at its earliest photo when imports predate its creation.
  // Split the string (not new Date(...)) so a UTC parse can't shift the day.
  const startDate = useMemo(
    () => trackingStartDate(album?.createdAt, profile.joinDate, photos.map(p => p.date), weights.map(w => w.date)),
    [album?.createdAt, profile.joinDate, photos, weights],
  );
  const [startYear, startMonth, startDayOfMonth] = startDate.split('-').map(Number);
  const isCurrentMonth = currentMonth.year === today.getFullYear() && currentMonth.month === today.getMonth() + 1;
  const isPastMonth = currentMonth.year < today.getFullYear() || (currentMonth.year === today.getFullYear() && currentMonth.month < today.getMonth() + 1);
  const rawDaysPassed = isCurrentMonth ? today.getDate() : isPastMonth ? daysInMonth : 0;
  // A2: daysPassed starts from the later of (first-of-month, album start)
  const isStartMonth = startYear === currentMonth.year && startMonth === currentMonth.month;
  const startDay = isStartMonth ? startDayOfMonth : 1;
  const daysPassed = Math.max(0, rawDaysPassed - (startDay - 1));
  const missed = Math.max(0, daysPassed - captured);

  const now = new Date();

  function handlePrevMonth() {
    setCurrentMonth(prev => {
      const prevTotal = prev.year * 12 + prev.month;
      const minTotal = startYear * 12 + startMonth;
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

  /** Every day's things live in the day view: the calendar, the charts and "+ log" all open it. */
  function openDay(date: string, focus?: 'weight') {
    router.push({ pathname: '/album/day', params: { albumId: id, date, ...(focus ? { focus } : {}) } });
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

      {/* Shown even without photos: a day can get a photo or a weight from here. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Album stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { fontFamily: fonts.light }]}>{photos.length}</Text>
            <Text style={typography.small}>{nounFor(photos.length, 'photo')}</Text>
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
          disablePrev={currentMonth.year * 12 + currentMonth.month <= startYear * 12 + startMonth}
        />
        <Animated.View style={monthPickerAnimatedStyle}>
          <MonthPicker
            year={currentMonth.year}
            month={currentMonth.month}
            onChange={(year, month) => setCurrentMonth({ year, month })}
            minYear={startYear}
            minMonth={startMonth}
            maxYear={now.getFullYear()}
            maxMonth={now.getMonth() + 1}
          />
        </Animated.View>
        <CalendarStats captured={captured} missed={missed} />
        <CalendarGrid
          year={currentMonth.year}
          month={currentMonth.month}
          photos={photos}
          joinDate={startDate}
          weightDates={weightDates}
          onDayPress={(date) => { haptics.tap(); openDay(date); }}
        />
        {captured === 0 && (isPastMonth || isCurrentMonth) && (
          <Text style={[styles.emptyMonthHint, { fontFamily: fonts.regular }]}>
            tap a day to add a photo or weight
          </Text>
        )}
        <TrendCard
          face={faceAvailable ? { photos, trend: faceTrend, waiting: photos.some(needsFaceScan), progress: faceProgress } : null}
          weights={weights}
          unit={unit}
          goal={album?.weightGoal}
          onSelectDate={(date) => openDay(date)}
          onCompare={() => router.push({ pathname: '/album/compare', params: { albumId: id } })}
          onLogWeight={(date) => (date ? openDay(date) : openDay(todayDate, 'weight'))}
        />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {photos.length >= 2 && (
          <Pressable
            style={({ pressed }) => [styles.timelapseBtn, pressed && { opacity: Pressed.filled }]}
            onPress={() => { haptics.tap(); router.push({ pathname: '/album/timelapse', params: { albumId: id } }); }}
            accessibilityLabel="Play timelapse"
            accessibilityRole="button"
          >
            <Play size={14} color={Colors.textSecondary} weight="fill" />
            <Text style={[styles.timelapseBtnText, { fontFamily: fonts.regular }]}>timelapse</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.captureBtn, pressed && { opacity: Pressed.filled }]}
          onPress={() => { haptics.tap(); router.push({ pathname: '/(tabs)/camera', params: { albumId: id } }); }}
          accessibilityLabel="Take photo"
          accessibilityRole="button"
        >
          <Camera size={18} color={Colors.bgPage} weight="regular" />
          <Text style={[styles.captureBtnText, { fontFamily: fonts.medium }]}>capture</Text>
        </Pressable>
      </View>

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
  emptyMonthHint: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: -8,
  },
});
