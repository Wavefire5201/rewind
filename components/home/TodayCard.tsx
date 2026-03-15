import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'phosphor-react-native';
import { Colors, Typography, BorderRadius } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import { formatDateLabel, formatTime } from '@/utils/dates';
import { getImageSource } from '@/utils/imageSource';

export default function TodayCard() {
  const { todayPhoto } = usePhotos();

  if (!todayPhoto) {
    return (
      <Pressable style={styles.emptyCard}>
        <Camera size={32} color={Colors.textTertiary} weight="light" />
        <Text style={[Typography.small, { color: Colors.textTertiary, marginTop: 8 }]}>
          Take today's photo
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Image
        source={getImageSource(todayPhoto.imageUri)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(26,26,28,0.8)', '#1A1A1C']}
        style={StyleSheet.absoluteFill}
        locations={[0.3, 0.7, 1]}
      />
      <View style={styles.overlay}>
        <Text style={[Typography.sectionLabel, styles.dateLabel]}>
          TODAY — {formatDateLabel(todayPhoto.date)}
        </Text>
        <Text style={Typography.caption}>{todayPhoto.caption}</Text>
        <Text style={Typography.small}>
          Captured at {formatTime(todayPhoto.capturedAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 340,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  emptyCard: {
    height: 340,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 4,
  },
  dateLabel: {
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
});
