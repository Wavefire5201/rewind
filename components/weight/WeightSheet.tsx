import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Pressed, Spacing } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import { formatDateLabel } from '@/utils/dates';
import { shiftDay } from '@/utils/days';
import { parseWeightInput, validRangeText, weightInputText } from '@/utils/weight';
import type { WeightEntry, WeightUnit, WeightValue } from '@/types';

interface WeightSheetProps {
  visible: boolean;
  /** The day it opens on. */
  date: string;
  /** The last day it can step to. */
  today: string;
  unit: WeightUnit;
  /** The album's weight on a day, if it has one. */
  entryFor: (date: string) => WeightEntry | undefined;
  onSave: (date: string, weight: WeightValue) => void;
  onDelete: (date: string) => void;
  onClose: () => void;
}

/** Logs, edits or deletes one day's weight, stepping between days without leaving the sheet. */
export default function WeightSheet({ visible, date: initialDate, today, unit, entryFor, onSave, onDelete, onClose }: WeightSheetProps) {
  const { fonts } = useFont();
  const [date, setDate] = useState(initialDate);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const existing = entryFor(date);

  // A fresh start each time it opens (set while rendering, so the first frame shows the day's weight).
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const opening = visible ? initialDate : null;
  if (opening !== openedOn) {
    setOpenedOn(opening);
    if (opening !== null) {
      setDate(opening);
      const entry = entryFor(opening);
      setText(entry ? weightInputText(entry, unit) : '');
      setInvalid(false);
    }
  }

  function step(days: number) {
    const next = shiftDay(date, days);
    if (next > today) return;
    haptics.tick();
    setDate(next);
    const entry = entryFor(next);
    setText(entry ? weightInputText(entry, unit) : '');
    setInvalid(false);
  }

  function handleSave() {
    // Untouched: keep the entry as it was entered, rather than re-storing a rounded conversion.
    if (existing && text.trim() === weightInputText(existing, unit)) {
      haptics.tap();
      onClose();
      return;
    }
    const weight = parseWeightInput(text, unit);
    if (!weight) {
      setInvalid(true);
      haptics.error();
      return;
    }
    haptics.success();
    onSave(date, weight);
  }

  function handleDelete() {
    haptics.success();
    onDelete(date);
  }

  const atToday = date >= today;

  return (
    // Inline, like the text-field sheets: it rises with the keyboard in the screen's window.
    <BottomSheet visible={visible} onClose={onClose} inline testID="weight-sheet">
      <View style={styles.body}>
        <Text style={[styles.title, { fontFamily: fonts.medium }]}>weight</Text>
        <View style={styles.dayRow}>
          <Pressable onPress={() => step(-1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous day">
            <CaretLeft size={16} color={Colors.textPrimary} weight="regular" />
          </Pressable>
          <Text style={[styles.day, { fontFamily: fonts.regular }]}>{date === today ? 'today' : formatDateLabel(date)}</Text>
          <Pressable
            onPress={() => step(1)}
            disabled={atToday}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: atToday }}
          >
            <CaretRight size={16} color={atToday ? Colors.textTertiary : Colors.textPrimary} weight="regular" />
          </Pressable>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { fontFamily: fonts.regular }]}
            value={text}
            onChangeText={(v) => { setText(v); if (invalid) setInvalid(false); }}
            placeholder="0.0"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            maxLength={6}
            accessibilityLabel={`Weight in ${unit}`}
          />
          <Text style={[styles.unit, { fontFamily: fonts.regular }]}>{unit}</Text>
        </View>
        {invalid ? (
          <Text style={[styles.errorHint, { fontFamily: fonts.regular }]}>enter a weight between {validRangeText(unit)}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.primary, pressed && { opacity: Pressed.filled }]}
            onPress={handleSave}
            accessibilityLabel="Save weight"
            accessibilityRole="button"
          >
            <Text style={[styles.primaryText, { fontFamily: fonts.medium }]}>save</Text>
          </Pressable>
          {existing ? (
            <Pressable
              style={({ pressed }) => [styles.button, styles.outlined, pressed && { opacity: Pressed.text }]}
              onPress={handleDelete}
              accessibilityLabel="Delete weight"
              accessibilityRole="button"
            >
              <Text style={[styles.outlinedText, { fontFamily: fonts.regular, color: Colors.danger }]}>delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.button, styles.outlined, pressed && { opacity: Pressed.text }]}
            onPress={() => { haptics.tap(); onClose(); }}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={[styles.outlinedText, { fontFamily: fonts.regular }]}>cancel</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4 },
  title: { fontFamily: Fonts.mono.medium, fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.lg },
  day: { fontFamily: Fonts.mono.regular, fontSize: 12, letterSpacing: 1, color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    marginTop: Spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.mono.regular,
    fontSize: 28,
    // No lineHeight: Android applies it to typed text but not to the placeholder, which then
    // sits higher than the digits and the unit.
    color: Colors.textPrimary,
    paddingVertical: 8,
  },
  unit: { fontFamily: Fonts.mono.regular, fontSize: 14, color: Colors.textSecondary },
  errorHint: { fontFamily: Fonts.mono.regular, fontSize: 12, color: Colors.danger, marginTop: 8 },
  actions: { gap: 8, marginTop: 20 },
  button: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  primary: { backgroundColor: Colors.accent },
  primaryText: { fontFamily: Fonts.mono.medium, fontSize: 12, letterSpacing: 1, color: Colors.bgPage },
  outlined: { borderWidth: 1, borderColor: Colors.borderPrimary },
  outlinedText: { fontFamily: Fonts.mono.regular, fontSize: 12, letterSpacing: 1, color: Colors.textPrimary },
});
