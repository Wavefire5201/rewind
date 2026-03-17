import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { haptics } from '@/utils/haptics';
import { Colors, Fonts } from '@/constants/theme';

interface ScrubberProps {
  currentIndex: number;
  total: number;
  startDate: string;
  endDate: string;
  onSeek: (index: number) => void;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

const THUMB_SIZE = 14;

function Scrubber({ currentIndex, total, startDate, endDate, onSeek }: ScrubberProps) {
  const trackWidth = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const lastSeekIndex = useRef(currentIndex);
  const isDragging = useSharedValue(false);

  // Sync thumb position from props when not dragging
  const progress = total > 1 ? currentIndex / (total - 1) : 0;

  const doSeek = useCallback((index: number) => {
    if (index !== lastSeekIndex.current) {
      lastSeekIndex.current = index;
      haptics.tap();
      onSeek(index);
    }
  }, [onSeek]);

  const computeIndex = useCallback((x: number, width: number): number => {
    'worklet';
    if (width <= 0 || total <= 1) return 0;
    const ratio = Math.min(Math.max(x / width, 0), 1);
    return Math.round(ratio * (total - 1));
  }, [total]);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      const clamped = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = clamped;
      const idx = computeIndex(clamped, trackWidth.value);
      runOnJS(doSeek)(idx);
    })
    .onUpdate((e) => {
      const clamped = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = clamped;
      const idx = computeIndex(clamped, trackWidth.value);
      runOnJS(doSeek)(idx);
    })
    .onEnd(() => {
      isDragging.value = false;
    })
    .onFinalize(() => {
      isDragging.value = false;
    })
    .minDistance(0);

  const tap = Gesture.Tap()
    .onEnd((e) => {
      const clamped = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = clamped;
      const idx = computeIndex(clamped, trackWidth.value);
      runOnJS(doSeek)(idx);
    });

  const gesture = Gesture.Race(pan, tap);

  const thumbStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      return { transform: [{ translateX: thumbX.value - THUMB_SIZE / 2 }] };
    }
    const w = trackWidth.value > 0 ? trackWidth.value : 1;
    const pos = (total > 1 ? currentIndex / (total - 1) : 0) * w;
    return { transform: [{ translateX: pos - THUMB_SIZE / 2 }] };
  }, [currentIndex, total]);

  const fillStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      const w = trackWidth.value > 0 ? trackWidth.value : 1;
      return { width: (thumbX.value / w) * 100 + '%' as any };
    }
    return { width: `${progress * 100}%` };
  }, [progress]);

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={styles.dateText}>{formatShortDate(startDate)}</Text>
        <Text style={styles.frameText}>{currentIndex + 1} / {total}</Text>
        <Text style={styles.dateText}>{formatShortDate(endDate)}</Text>
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={styles.hitArea}
          onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default React.memo(Scrubber);

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  frameText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  hitArea: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: Colors.accent,
  },
  thumb: {
    position: 'absolute',
    top: (40 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: Colors.accent,
  },
});
