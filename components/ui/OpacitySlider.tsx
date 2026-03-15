import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface OpacitySliderProps {
  value: number;
  onValueChange: (value: number) => void;
}

const THUMB_SIZE = 10;

export default function OpacitySlider({ value, onValueChange }: OpacitySliderProps) {
  const trackWidth = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const doChange = useCallback((ratio: number) => {
    const snapped = Math.round(ratio * 20) / 20; // 5% increments
    onValueChange(snapped);
  }, [onValueChange]);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      const clamped = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = clamped;
      const ratio = trackWidth.value > 0 ? clamped / trackWidth.value : 0;
      runOnJS(doChange)(ratio);
    })
    .onUpdate((e) => {
      const clamped = Math.min(Math.max(e.x, 0), trackWidth.value);
      thumbX.value = clamped;
      const ratio = trackWidth.value > 0 ? clamped / trackWidth.value : 0;
      runOnJS(doChange)(ratio);
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
      const ratio = trackWidth.value > 0 ? clamped / trackWidth.value : 0;
      runOnJS(doChange)(ratio);
    });

  const gesture = Gesture.Race(pan, tap);

  const thumbStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      return { transform: [{ translateX: thumbX.value - THUMB_SIZE / 2 }] };
    }
    const w = trackWidth.value > 0 ? trackWidth.value : 1;
    return { transform: [{ translateX: value * w - THUMB_SIZE / 2 }] };
  }, [value]);

  const fillStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      const w = trackWidth.value > 0 ? trackWidth.value : 1;
      return { width: (thumbX.value / w) * 100 + '%' as any };
    }
    return { width: `${value * 100}%` };
  }, [value]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={styles.container}
        onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
      >
        <Animated.View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </Animated.View>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: Colors.textPrimary,
  },
  thumb: {
    position: 'absolute',
    top: (28 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: Colors.textPrimary,
  },
});
