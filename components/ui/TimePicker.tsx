import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i); // 0-23
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i); // 0-59
const PERIODS = ['AM', 'PM'];

function parse24h(value: string): { hour: number; minute: number } {
  const [hStr, mStr] = value.split(':');
  return { hour: parseInt(hStr, 10), minute: parseInt(mStr, 10) };
}

function to12h(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour12, period };
}

function from12h(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM' && hour12 === 12) return 0;
  if (period === 'PM' && hour12 !== 12) return hour12 + 12;
  return hour12;
}

interface TimePickerProps {
  value: string; // "HH:MM" in 24h format
  onChange: (value: string) => void;
  use24h?: boolean;
}

interface WheelProps {
  data: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
  formatItem?: (item: string | number) => string;
}

function Wheel({ data, selectedIndex, onSelect, width, formatItem }: WheelProps) {
  const { fonts } = useFont();
  const translateY = useSharedValue(-selectedIndex * ITEM_HEIGHT);
  const savedTranslateY = useSharedValue(-selectedIndex * ITEM_HEIGHT);
  const lastReportedIndex = useRef(selectedIndex);
  const maxIndex = data.length - 1;

  const doHaptic = useCallback(() => haptics.tap(), []);

  const reportSelect = useCallback(
    (index: number) => {
      if (index !== lastReportedIndex.current) {
        lastReportedIndex.current = index;
        onSelect(index);
      }
    },
    [onSelect],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetY([-5, 5])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd((e) => {
      const projected = translateY.value + e.velocityY * 0.15;
      const rawIndex = Math.round(-projected / ITEM_HEIGHT);
      const snappedIndex = Math.max(0, Math.min(rawIndex, maxIndex));
      const target = -snappedIndex * ITEM_HEIGHT;

      translateY.value = withSpring(target, {
        damping: 20,
        stiffness: 200,
        mass: 0.5,
      });
      savedTranslateY.value = target;

      runOnJS(doHaptic)();
      runOnJS(reportSelect)(snappedIndex);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const centerOffset = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.wheelContainer, { width, height: ITEM_HEIGHT * VISIBLE_ITEMS }]}>
        <Animated.View style={[{ paddingTop: centerOffset }, animatedStyle]}>
          {data.map((item, i) => {
            const display = formatItem ? formatItem(item) : String(item);
            return (
              <View key={`${item}-${i}`} style={[styles.wheelItem, { width, height: ITEM_HEIGHT }]}>
                <Text style={[styles.wheelItemText, { fontFamily: fonts.light }]}>{display}</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default function TimePicker({ value, onChange, use24h = false }: TimePickerProps) {
  const { fonts } = useFont();
  const parsed = parse24h(value);
  const { hour12, period } = to12h(parsed.hour);

  const hourRef = useRef(use24h ? parsed.hour : hour12);
  const minuteRef = useRef(parsed.minute);
  const periodRef = useRef(period);

  const emit = useCallback(() => {
    const h24 = use24h ? hourRef.current : from12h(hourRef.current, periodRef.current);
    const val = `${String(h24).padStart(2, '0')}:${String(minuteRef.current).padStart(2, '0')}`;
    onChange(val);
  }, [onChange, use24h]);

  const handleHourSelect = useCallback((index: number) => {
    const hours = use24h ? HOURS_24 : HOURS_12;
    hourRef.current = hours[index];
    emit();
  }, [emit, use24h]);

  const handleMinuteSelect = useCallback((index: number) => {
    minuteRef.current = MINUTES_60[index];
    emit();
  }, [emit]);

  const handlePeriodSelect = useCallback((index: number) => {
    periodRef.current = PERIODS[index] as 'AM' | 'PM';
    emit();
  }, [emit]);

  const hours = use24h ? HOURS_24 : HOURS_12;
  const hourIndex = hours.indexOf(use24h ? parsed.hour : hour12);
  const minuteIndex = parsed.minute;
  const periodIndex = PERIODS.indexOf(period);

  return (
    <View style={styles.container}>
      <View style={styles.selectionBand} pointerEvents="none" />

      <View style={styles.wheels}>
        <Wheel
          data={hours}
          selectedIndex={Math.max(0, hourIndex)}
          onSelect={handleHourSelect}
          width={56}
          formatItem={(item) => String(item).padStart(2, '0')}
        />
        <Text style={[styles.colon, { fontFamily: fonts.light }]}>:</Text>
        <Wheel
          data={MINUTES_60}
          selectedIndex={minuteIndex}
          onSelect={handleMinuteSelect}
          width={56}
          formatItem={(item) => String(item).padStart(2, '0')}
        />
        {!use24h && (
          <>
            <View style={{ width: 12 }} />
            <Wheel
              data={PERIODS}
              selectedIndex={periodIndex}
              onSelect={handlePeriodSelect}
              width={44}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    paddingVertical: 12,
  },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12 + ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderPrimary,
    zIndex: 1,
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelContainer: {
    overflow: 'hidden',
  },
  colon: {
    fontFamily: Fonts.mono.light,
    fontSize: 22,
    color: Colors.textTertiary,
    marginHorizontal: 4,
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontFamily: Fonts.mono.light,
    fontSize: 22,
    color: Colors.textPrimary,
  },
});
