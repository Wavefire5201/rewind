import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Play, Pause, SkipBack, SkipForward } from 'phosphor-react-native';
import { haptics } from '@/utils/haptics';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';

function formatBadgeDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}
import { getImageSource } from '@/utils/imageSource';
import type { PhotoEntry } from '@/types';

export interface TimelapsePlayerHandle {
  seekTo: (index: number) => void;
}

interface TimelapsePlayerProps {
  photos: PhotoEntry[];
  speed: number;
  onFrameChange?: (index: number) => void;
  onPlaybackEnd?: (index: number) => void;
}

const TimelapsePlayer = forwardRef<TimelapsePlayerHandle, TimelapsePlayerProps>(
  function TimelapsePlayer({ photos, speed, onFrameChange, onPlaybackEnd }, ref) {
    const { fonts } = useFont();
    const [frameIndex, setFrameIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const frameRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const speedRef = useRef(speed);
    const onFrameChangeRef = useRef(onFrameChange);
    const onPlaybackEndRef = useRef(onPlaybackEnd);

    speedRef.current = speed;
    onFrameChangeRef.current = onFrameChange;
    onPlaybackEndRef.current = onPlaybackEnd;

    useImperativeHandle(ref, () => ({
      seekTo(index: number) {
        frameRef.current = index;
        setFrameIndex(index);
      },
    }));

    const stopPlayback = useCallback(() => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current as unknown as number);
        intervalRef.current = null;
      }
      setIsPlaying(false);
      onPlaybackEndRef.current?.(frameRef.current);
    }, []);

    const startPlayback = useCallback(() => {
      if (photos.length <= 1) return;
      setIsPlaying(true);

      const schedule = () => {
        intervalRef.current = setTimeout(() => {
          frameRef.current = frameRef.current >= photos.length - 1 ? 0 : frameRef.current + 1;
          setFrameIndex(frameRef.current);
          onFrameChangeRef.current?.(frameRef.current);
          if (intervalRef.current !== null) schedule();
        }, 500 / speedRef.current) as unknown as ReturnType<typeof setTimeout>;
      };
      schedule();
    }, [photos.length]);

    useEffect(() => {
      return () => {
        if (intervalRef.current) clearTimeout(intervalRef.current as unknown as number);
      };
    }, []);

    const togglePlay = useCallback(() => {
      haptics.tap();
      if (isPlaying) stopPlayback();
      else startPlayback();
    }, [isPlaying, stopPlayback, startPlayback]);

    const skipPrev = useCallback(() => {
      haptics.tap();
      const next = frameRef.current > 0 ? frameRef.current - 1 : photos.length - 1;
      frameRef.current = next;
      setFrameIndex(next);
      onPlaybackEndRef.current?.(next);
    }, [photos.length]);

    const skipNext = useCallback(() => {
      haptics.tap();
      const next = frameRef.current < photos.length - 1 ? frameRef.current + 1 : 0;
      frameRef.current = next;
      setFrameIndex(next);
      onPlaybackEndRef.current?.(next);
    }, [photos.length]);

    const current = photos[frameIndex];

    return (
      <View style={styles.wrapper}>
        <View style={styles.screen}>
          {current && (
            <Image
              source={getImageSource(current.imageUri)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}

          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontFamily: fonts.regular }]}>
              {current ? formatBadgeDate(current.date) : ''}
            </Text>
          </View>

          {/* Transport overlaid at bottom of image */}
          <View style={styles.transport}>
            <Pressable onPress={skipPrev} hitSlop={12} style={styles.transportBtn}>
              <SkipBack size={18} color={Colors.textPrimary} weight="fill" />
            </Pressable>
            <Pressable onPress={togglePlay} style={styles.playBtn}>
              {isPlaying ? (
                <Pause size={22} color={Colors.textPrimary} weight="fill" />
              ) : (
                <Play size={22} color={Colors.textPrimary} weight="fill" />
              )}
            </Pressable>
            <Pressable onPress={skipNext} hitSlop={12} style={styles.transportBtn}>
              <SkipForward size={18} color={Colors.textPrimary} weight="fill" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
);

export default TimelapsePlayer;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  screen: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: Colors.bgPageTranslucent,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textPrimary,
  },
  transport: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 8,
    backgroundColor: 'rgba(26,26,28,0.6)',
  },
  transportBtn: {
    padding: 6,
  },
  playBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
