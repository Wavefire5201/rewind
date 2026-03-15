import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Export, Camera } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Fonts } from '@/constants/theme';
import TimelapsePlayer, { TimelapsePlayerHandle } from '@/components/timelapse/TimelapsePlayer';
import Scrubber from '@/components/timelapse/Scrubber';
import Filmstrip from '@/components/timelapse/Filmstrip';
import SpeedSelector from '@/components/timelapse/SpeedSelector';
import { usePhotos } from '@/hooks/usePhotos';

export default function TimelapseScreen() {
  const { photos } = usePhotos();
  const [speed, setSpeed] = useState(1);
  const [displayIndex, setDisplayIndex] = useState(0);
  const playerRef = useRef<TimelapsePlayerHandle>(null);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Coming Soon', 'Export will be available in a future update.');
  }

  if (photos.length < 2) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Camera size={48} color={Colors.textTertiary} weight="light" />
          <Text style={styles.emptyText}>
            Take more photos to create your timelapse
          </Text>
        </View>
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

        {/* Player fills remaining space */}
        <TimelapsePlayer
          ref={playerRef}
          photos={photos}
          speed={speed}
          onFrameChange={handleFrameChange}
          onPlaybackEnd={handlePlaybackEnd}
        />

        {/* Controls grouped at bottom — fixed height */}
        <View style={styles.controls}>
          <Scrubber
            currentIndex={displayIndex}
            total={photos.length}
            startDate={photos[0].date}
            endDate={photos[photos.length - 1].date}
            onSeek={handleSeek}
          />
          <Filmstrip
            photos={photos}
            currentIndex={displayIndex}
            onSelect={handleFilmstripSelect}
          />
          <SpeedSelector selectedSpeed={speed} onSelect={handleSpeedSelect} />
        </View>
      </View>
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
});
