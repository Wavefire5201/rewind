import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import { parseWeightInput, validRangeText, weightInputText } from '@/utils/weight';
import type { WeightEntry, WeightUnit, WeightValue } from '@/types';

interface WeightFieldProps {
  /** The day's weight, if it has one. */
  entry: WeightEntry | undefined;
  unit: WeightUnit;
  /** A new weight, or null to delete the day's one. Not called when nothing changed. */
  onCommit: (weight: WeightValue | null) => void;
  autoFocus?: boolean;
}

/**
 * A day's weight, always editable: it saves when submitted, when it loses focus (swiping to another
 * day), and when it goes away still holding a typed value (closing the day view, which unmounts it
 * before any blur arrives). Empty means no weight; an unchanged value writes nothing.
 */
export default function WeightField({ entry, unit, onCommit, autoFocus }: WeightFieldProps) {
  const { fonts } = useFont();
  const shown = entry ? weightInputText(entry, unit) : '';
  const [text, setText] = useState(shown);
  const [invalid, setInvalid] = useState(false);

  // Another day, a saved change, or a unit switch: start from what's stored (set while rendering,
  // not in an effect, so the first frame shows it).
  const [shownFor, setShownFor] = useState(shown);
  // What the last commit sent, so a blur followed by an unmount doesn't send it twice.
  const committed = useRef<string | null>(null);
  if (shown !== shownFor) {
    setShownFor(shown);
    setText(shown);
    setInvalid(false);
    committed.current = null;
  }

  function commit() {
    const typed = text.trim();
    if (typed === shown || typed === committed.current) return;
    if (typed === '') {
      if (entry) {
        committed.current = typed;
        onCommit(null);
      }
      return;
    }
    const weight = parseWeightInput(typed, unit);
    if (!weight) {
      setInvalid(true);
      haptics.error();
      return;
    }
    committed.current = typed;
    onCommit(weight);
  }

  // On the way out, commit whatever is still typed. The ref holds this render's commit, so the
  // cleanup sees the latest text rather than the first render's.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { fontFamily: fonts.regular }]}
          value={text}
          onChangeText={(v) => { setText(v); if (invalid) setInvalid(false); }}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder="add weight"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={6}
          autoFocus={autoFocus}
          accessibilityLabel={`Weight in ${unit}`}
        />
        <Text style={[styles.unit, { fontFamily: fonts.regular }]}>{unit}</Text>
      </View>
      {invalid ? (
        <Text style={[styles.error, { fontFamily: fonts.regular }]}>enter a weight between {validRangeText(unit)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Baseline-aligned, and the input has no lineHeight: Android applies it to typed text but not
  // to the placeholder, which then sits higher than the unit.
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.mono.regular,
    fontSize: 20,
    color: Colors.textPrimary,
    paddingVertical: 8,
  },
  unit: { fontFamily: Fonts.mono.regular, fontSize: 14, color: Colors.textSecondary },
  error: { fontFamily: Fonts.mono.regular, fontSize: 12, color: Colors.danger, marginTop: Spacing.sm },
});
