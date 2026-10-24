import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CaretLeft, CaretRight, X } from 'phosphor-react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { formatMonthYear, getCalendarMonth, getFirstWeekday, getToday } from '@/utils/dates';
import { haptics } from '@/utils/haptics';

export interface DatePickerSheetProps {
  visible: boolean;
  /** YYYY-MM-DD: selected, and its month shown, when the sheet opens. */
  value: string;
  /** YYYY-MM-DD: later days are dimmed and can't be picked. */
  maxDate: string;
  /** Days that already have a photo get a dot. */
  photoDates: ReadonlySet<string>;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

type Month = { year: number; month: number }; // month 1-12
type Mode = 'days' | 'years' | 'months';

const WEEKDAY_LETTERS = ['s', 'm', 't', 'w', 't', 'f', 's'];
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** A swipe past this distance or speed changes month. */
const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 500;
const GRID_FADE = FadeIn.duration(160);

const monthOf = (date: string): Month => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
const monthIndex = ({ year, month }: Month) => year * 12 + (month - 1);
const fromIndex = (index: number): Month => ({ year: Math.floor(index / 12), month: (index % 12) + 1 });
const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toLowerCase();
const confirmLabel = (date: string) => `use ${MONTH_SHORT[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;

/**
 * The app's date picker: a month grid in a bottom sheet. Days with a photo are dotted, days after
 * `maxDate` can't be picked, and tapping the month title jumps by year, then month.
 */
export default function DatePickerSheet({ visible, value, maxDate, photoDates, onConfirm, onClose }: DatePickerSheetProps) {
  const { fonts } = useFont();
  const [selected, setSelected] = useState(value);
  const [shown, setShown] = useState(() => monthOf(value));
  const [mode, setMode] = useState<Mode>('days');
  const [pickedYear, setPickedYear] = useState(() => monthOf(value).year);

  // Each opening starts from the current value, on its month.
  const [openFor, setOpenFor] = useState<string | null>(visible ? value : null);
  if (visible && openFor !== value) {
    setOpenFor(value);
    setSelected(value);
    setShown(monthOf(value));
    setMode('days');
  } else if (!visible && openFor !== null) {
    setOpenFor(null);
  }

  const max = monthOf(maxDate);
  const years = useMemo(() => {
    let first = max.year - 10;
    photoDates.forEach((d) => { first = Math.min(first, Number(d.slice(0, 4))); });
    first = Math.min(first, monthOf(value).year);
    return Array.from({ length: max.year - first + 1 }, (_, i) => first + i);
  }, [photoDates, max.year, value]);
  const minIndex = monthIndex({ year: years[0], month: 1 });
  const maxIndex = monthIndex(max);
  const shownIndex = monthIndex(shown);
  const today = getToday();

  const weeks = useMemo(() => getCalendarMonth(shown.year, shown.month), [shown.year, shown.month]);
  const weekdays = useMemo(() => {
    const first = getFirstWeekday();
    return WEEKDAY_LETTERS.map((_, i) => WEEKDAY_LETTERS[(first + i) % 7]);
  }, []);

  function goToMonth(index: number) {
    if (index < minIndex || index > maxIndex || index === shownIndex) return;
    haptics.tick();
    setShown(fromIndex(index));
  }

  // Swipe left for the next month, right for the previous one. Runs on JS: it only sets state.
  const swipe = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < SWIPE_DISTANCE && Math.abs(e.velocityX) < SWIPE_VELOCITY) return;
      const next = shownIndex + ((e.translationX || e.velocityX) < 0 ? 1 : -1);
      if (next < minIndex || next > maxIndex) return;
      haptics.tick();
      setShown(fromIndex(next));
    }), [shownIndex, minIndex, maxIndex]);

  function pickDay(date: string) {
    if (date > maxDate || date === selected) return;
    haptics.tick();
    setSelected(date);
  }

  function pickYear(year: number) {
    haptics.tick();
    setPickedYear(year);
    setMode('months');
  }

  function pickMonth(month: number) {
    haptics.tick();
    setShown({ year: pickedYear, month });
    setMode('days');
  }

  function openYears() {
    haptics.tap();
    setMode(mode === 'days' ? 'years' : 'days');
  }

  const title = mode === 'days' ? formatMonthYear(shown.year, shown.month) : mode === 'years' ? 'pick a year' : String(pickedYear);
  const arrowsShown = mode === 'days';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={[styles.heading, { fontFamily: fonts.medium }]}>photo date</Text>
        <Pressable
          onPress={() => { haptics.tap(); onClose(); }}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: Pressed.text }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={Colors.textSecondary} weight="light" />
        </Pressable>
      </View>

      <View style={styles.monthBar}>
        <Pressable
          onPress={() => goToMonth(shownIndex - 1)}
          disabled={!arrowsShown || shownIndex <= minIndex}
          hitSlop={10}
          style={({ pressed }) => [styles.arrow, (!arrowsShown || shownIndex <= minIndex) && styles.arrowDisabled, pressed && { opacity: Pressed.text }]}
          accessibilityRole="button"
          accessibilityLabel="previous month"
          accessibilityState={{ disabled: !arrowsShown || shownIndex <= minIndex }}
        >
          <CaretLeft size={16} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Pressable
          onPress={openYears}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: Pressed.text }]}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint={mode === 'days' ? 'pick a year' : 'back to the days'}
        >
          <Text style={[styles.title, { fontFamily: fonts.regular }]}>{title}</Text>
        </Pressable>
        <Pressable
          onPress={() => goToMonth(shownIndex + 1)}
          disabled={!arrowsShown || shownIndex >= maxIndex}
          hitSlop={10}
          style={({ pressed }) => [styles.arrow, (!arrowsShown || shownIndex >= maxIndex) && styles.arrowDisabled, pressed && { opacity: Pressed.text }]}
          accessibilityRole="button"
          accessibilityLabel="next month"
          accessibilityState={{ disabled: !arrowsShown || shownIndex >= maxIndex }}
        >
          <CaretRight size={16} color={Colors.textPrimary} weight="regular" />
        </Pressable>
      </View>

      {mode === 'days' && (
        <GestureDetector gesture={swipe}>
          <Animated.View key={`${shown.year}-${shown.month}`} entering={GRID_FADE} style={styles.grid}>
            <View style={styles.week}>
              {weekdays.map((letter, i) => (
                <Text key={i} style={[styles.weekday, { fontFamily: fonts.regular }]}>{letter}</Text>
              ))}
            </View>
            {weeks.map((week, w) => (
              <View key={w} style={styles.week}>
                {week.map((date, i) => {
                  if (!date) return <View key={i} style={styles.cell} />;
                  const isSelected = date === selected;
                  const disabled = date > maxDate;
                  const isToday = date === today;
                  const hasPhoto = photoDates.has(date);
                  return (
                    <Pressable
                      key={date}
                      onPress={() => pickDay(date)}
                      disabled={disabled}
                      style={[styles.cell, disabled && styles.dayDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel={longDate(date)}
                      accessibilityHint={hasPhoto ? 'has a photo' : undefined}
                      accessibilityState={{ selected: isSelected, disabled }}
                    >
                      {/* One fixed square for both marks, so they match whatever the cell's width. */}
                      {isSelected || isToday ? (
                        <View testID="day-mark" style={[styles.mark, isSelected ? styles.markSelected : styles.markToday]} />
                      ) : null}
                      <Text style={[styles.day, isToday && styles.todayText, isSelected && styles.selectedText, { fontFamily: isSelected ? fonts.medium : fonts.regular }]}>
                        {Number(date.slice(8, 10))}
                      </Text>
                      {hasPhoto ? <View style={[styles.dot, isSelected && styles.dotSelected]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      )}

      {mode === 'years' && (
        <Animated.View entering={GRID_FADE} style={styles.choices}>
          {inRowsOfThree(years.map((year) => (
            <Choice
              key={year}
              label={String(year)}
              current={year === shown.year}
              onPress={() => pickYear(year)}
              fontFamily={fonts.regular}
            />
          )))}
        </Animated.View>
      )}

      {mode === 'months' && (
        <Animated.View entering={GRID_FADE} style={styles.choices}>
          {inRowsOfThree(MONTH_SHORT.map((label, i) => (
            <Choice
              key={label}
              label={label}
              current={pickedYear === shown.year && i + 1 === shown.month}
              disabled={monthIndex({ year: pickedYear, month: i + 1 }) > maxIndex}
              onPress={() => pickMonth(i + 1)}
              fontFamily={fonts.regular}
            />
          )))}
        </Animated.View>
      )}

      <Pressable
        onPress={() => { haptics.tap(); onConfirm(selected); }}
        style={({ pressed }) => [styles.confirm, pressed && { opacity: Pressed.filled }]}
        accessibilityRole="button"
        accessibilityLabel={confirmLabel(selected)}
      >
        <Text style={[styles.confirmText, { fontFamily: fonts.medium }]}>{confirmLabel(selected)}</Text>
      </Pressable>
    </BottomSheet>
  );
}

/** Rows of three equal boxes; the last row is padded so its boxes keep the same width. */
function inRowsOfThree(items: React.ReactElement[]) {
  const rows: React.ReactElement[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return rows.map((row, r) => (
    <View key={r} testID="choice-row" style={styles.choiceRow}>
      {row}
      {Array.from({ length: 3 - row.length }, (_, k) => <View key={`spacer-${k}`} style={styles.choiceBox} />)}
    </View>
  ));
}

function Choice({ label, current, disabled = false, onPress, fontFamily }: {
  label: string;
  current: boolean;
  disabled?: boolean;
  onPress: () => void;
  fontFamily: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.choiceBox, current && styles.choiceCurrent, disabled && styles.choiceDisabled, pressed && { opacity: Pressed.text }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: current, disabled }}
    >
      {/* The border is an overlay: on the flex:1 box itself it would make the box wider than its siblings. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.choiceBorder, current && styles.choiceBorderCurrent]} />
      <Text style={[styles.choiceText, current && styles.choiceTextCurrent, { fontFamily }]}>{label}</Text>
    </Pressable>
  );
}

const CELL = 40;
const MARK = 36;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heading: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  arrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.25,
  },
  title: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.textTertiary,
    paddingBottom: 1,
  },
  grid: {
    gap: 4,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.textSecondary,
    paddingBottom: 4,
  },
  cell: {
    flex: 1,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // A fixed square behind the number: same size for the selected day and today.
  mark: {
    position: 'absolute',
    width: MARK,
    height: MARK,
  },
  markSelected: {
    backgroundColor: Colors.accent,
  },
  markToday: {
    borderWidth: 1,
    borderColor: Colors.streak,
  },
  todayText: {
    color: Colors.streak,
  },
  selectedText: {
    color: Colors.bgPage,
  },
  dayDisabled: {
    opacity: 0.35,
  },
  dot: {
    position: 'absolute',
    bottom: (CELL - MARK) / 2 + 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.accent,
  },
  dotSelected: {
    backgroundColor: Colors.bgPage,
  },
  choices: {
    gap: 6,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  choiceBox: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBorder: {
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  choiceBorderCurrent: {
    borderColor: Colors.accent,
  },
  choiceCurrent: {
    backgroundColor: Colors.accent,
  },
  choiceDisabled: {
    opacity: 0.35,
  },
  choiceText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  choiceTextCurrent: {
    color: Colors.bgPage,
  },
  confirm: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  confirmText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.bgPage,
  },
});
