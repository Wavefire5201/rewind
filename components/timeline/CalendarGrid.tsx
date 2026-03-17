import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Fonts } from '@/constants/theme';
import { getCalendarMonth, getToday } from '@/utils/dates';
import { getImageSource } from '@/utils/imageSource';
import type { PhotoEntry } from '@/types';

interface CalendarGridProps {
  year: number;
  month: number;
  photos: PhotoEntry[];
  joinDate: string;
  onDayPress: (date: string) => void;
}

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Cell size is dynamic — use flex instead of fixed width

export default function CalendarGrid({ year, month, photos, joinDate, onDayPress }: CalendarGridProps) {
  const weeks = getCalendarMonth(year, month);
  const today = getToday();
  const photoMap = new Map<string, PhotoEntry>(photos.map(p => [p.date, p]));

  return (
    <View style={styles.container}>
      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((label, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((date, di) => {
            if (date === null) {
              return <View key={di} style={styles.cell} />;
            }

            const photo = photoMap.get(date) ?? null;
            const isToday = date === today;
            const isFuture = date > today;
            const isBeforeJoin = date < joinDate;

            // Before join date: empty cell (user wasn't tracking yet)
            if (isBeforeJoin) {
              return <View key={di} style={styles.cell} />;
            }

            // Future day
            if (isFuture) {
              return (
                <View key={di} style={styles.cell}>
                  <Text style={[styles.dayNumber, { opacity: 0.3 }]}>
                    {parseInt(date.split('-')[2], 10)}
                  </Text>
                </View>
              );
            }

            // Today with photo
            if (isToday && photo) {
              return (
                <TouchableOpacity
                  key={di}
                  style={[styles.cell, styles.photoCell, styles.todayCell]}
                  onPress={() => onDayPress(date)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={getImageSource(photo.imageUri)}
                    style={styles.thumbnail}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              );
            }

            // Today without photo
            if (isToday && !photo) {
              return (
                <View key={di} style={[styles.cell, styles.todayCell]}>
                  <Text style={[styles.dayNumber, styles.todayNumber]}>
                    {parseInt(date.split('-')[2], 10)}
                  </Text>
                </View>
              );
            }

            // Past day with photo
            if (photo) {
              return (
                <TouchableOpacity
                  key={di}
                  style={[styles.cell, styles.photoCell]}
                  onPress={() => onDayPress(date)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={getImageSource(photo.imageUri)}
                    style={styles.thumbnail}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              );
            }

            // Past day, no photo (missed)
            return (
              <View key={di} style={styles.cell}>
                <Text style={styles.dayNumber}>
                  {parseInt(date.split('-')[2], 10)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCell: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  todayCell: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.textSecondary,
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  dayNumber: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textTertiary,
  },
  todayNumber: {
    color: Colors.textPrimary,
  },
});
