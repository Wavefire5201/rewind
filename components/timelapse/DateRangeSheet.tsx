import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import PillButton from '@/components/ui/PillButton';

interface DateRangeSheetProps {
  visible: boolean;
  dates: string[];       // available YYYY-MM-DD dates
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

/** "March 2, 2026", for screen readers (the list shows 03/02/26). */
function formatLongDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMMDDYY(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
}

export default function DateRangeSheet({
  visible,
  dates,
  startDate,
  endDate,
  onApply,
  onClose,
}: DateRangeSheetProps) {
  const { fonts } = useFont();
  const insets = useSafeAreaInsets();
  const [selStart, setSelStart] = useState(startDate);
  const [selEnd, setSelEnd] = useState(endDate);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  const listScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setSelStart(startDate);
      setSelEnd(endDate);
      setActiveField(null);
    }
  }, [visible, startDate, endDate]);

  function handleStartFieldTap() {
    haptics.tap();
    setActiveField(prev => (prev === 'start' ? null : 'start'));
  }

  function handleEndFieldTap() {
    haptics.tap();
    setActiveField(prev => (prev === 'end' ? null : 'end'));
  }

  function handleDateSelect(date: string) {
    haptics.tap();
    if (activeField === 'start') {
      if (date > selEnd) {
        setSelStart(selEnd);
        setSelEnd(date);
        setActiveField('end');
      } else {
        setSelStart(date);
        setActiveField(null);
      }
    } else if (activeField === 'end') {
      if (date < selStart) {
        setSelEnd(selStart);
        setSelStart(date);
        setActiveField('start');
      } else {
        setSelEnd(date);
        setActiveField(null);
      }
    }
  }

  function handleReset() {
    haptics.tap();
    if (dates.length > 0) {
      setSelStart(dates[0]);
      setSelEnd(dates[dates.length - 1]);
      setActiveField(null);
    }
  }

  function handleApply() {
    haptics.success();
    onApply(selStart, selEnd);
  }

  const sortedDates = useMemo(() => [...dates].sort(), [dates]);

  // Closing taps, like closing the photo viewer.
  const dismiss = () => {
    haptics.tap();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={dismiss} testID="sheet-backdrop" accessible={false} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: fonts.medium }]}>date range</Text>
          <Pressable
            onPress={dismiss}
            hitSlop={12}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={Colors.textSecondary} weight="light" />
          </Pressable>
        </View>

        {/* Date field row */}
        <View style={styles.fieldRow}>
          <Pressable
            style={({ pressed }) => [styles.dateField, activeField === 'start' && styles.dateFieldActive, pressed && { opacity: 0.7 }]}
            onPress={handleStartFieldTap}
            accessibilityRole="button"
            accessibilityLabel="Start date"
            accessibilityValue={{ text: formatLongDate(selStart) }}
            accessibilityState={{ expanded: activeField === 'start' }}
          >
            <Text style={[styles.dateFieldText, activeField === 'start' && styles.dateFieldTextActive, { fontFamily: fonts.regular }]}>
              {formatMMDDYY(selStart)}
            </Text>
          </Pressable>

          <Text style={[styles.toText, { fontFamily: fonts.regular }]}>to</Text>

          <Pressable
            style={({ pressed }) => [styles.dateField, activeField === 'end' && styles.dateFieldActive, pressed && { opacity: 0.7 }]}
            onPress={handleEndFieldTap}
            accessibilityRole="button"
            accessibilityLabel="End date"
            accessibilityValue={{ text: formatLongDate(selEnd) }}
            accessibilityState={{ expanded: activeField === 'end' }}
          >
            <Text style={[styles.dateFieldText, activeField === 'end' && styles.dateFieldTextActive, { fontFamily: fonts.regular }]}>
              {formatMMDDYY(selEnd)}
            </Text>
          </Pressable>
        </View>

        {/* Scrollable date list */}
        {activeField !== null && (
          <ScrollView
            ref={listScrollRef}
            style={styles.dateList}
            showsVerticalScrollIndicator={false}
          >
            {sortedDates.map((date) => {
              const isSelected =
                (activeField === 'start' && date === selStart) ||
                (activeField === 'end' && date === selEnd);
              return (
                <Pressable
                  key={date}
                  style={({ pressed }) => [styles.dateListItem, isSelected && styles.dateListItemSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => handleDateSelect(date)}
                  accessibilityRole="button"
                  accessibilityLabel={formatLongDate(date)}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.dateListText, isSelected && styles.dateListTextSelected, { fontFamily: fonts.regular }]}>
                    {formatMMDDYY(date)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Footer buttons */}
        <View style={styles.footer}>
          <PillButton
            label="reset to all"
            variant="outlined"
            size="medium"
            onPress={handleReset}
            haptic={false}
            style={styles.footerButton}
            accessibilityLabel="Show all dates"
          />
          <PillButton
            label="apply"
            size="medium"
            onPress={handleApply}
            haptic={false}
            style={styles.footerButton}
            accessibilityLabel="Apply date range"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dateField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
  },
  dateFieldActive: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  dateFieldText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dateFieldTextActive: {
    color: Colors.accent,
  },
  toText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  dateList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  dateListItem: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
  },
  dateListItemSelected: {
    backgroundColor: Colors.bgSurface,
  },
  dateListText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dateListTextSelected: {
    color: Colors.accent,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  footerButton: {
    flex: 1,
  },
});
