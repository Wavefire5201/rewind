import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

interface DateRangeSheetProps {
  visible: boolean;
  dates: string[];       // available YYYY-MM-DD dates
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
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

  const sortedDates = [...dates].sort();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Date Range</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={20} color={Colors.textSecondary} weight="light" />
          </TouchableOpacity>
        </View>

        {/* Date field row */}
        <View style={styles.fieldRow}>
          <TouchableOpacity
            style={[styles.dateField, activeField === 'start' && styles.dateFieldActive]}
            onPress={handleStartFieldTap}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateFieldText, activeField === 'start' && styles.dateFieldTextActive]}>
              {formatMMDDYY(selStart)}
            </Text>
          </TouchableOpacity>

          <Text style={styles.toText}>TO</Text>

          <TouchableOpacity
            style={[styles.dateField, activeField === 'end' && styles.dateFieldActive]}
            onPress={handleEndFieldTap}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateFieldText, activeField === 'end' && styles.dateFieldTextActive]}>
              {formatMMDDYY(selEnd)}
            </Text>
          </TouchableOpacity>
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
                <TouchableOpacity
                  key={date}
                  style={[styles.dateListItem, isSelected && styles.dateListItemSelected]}
                  onPress={() => handleDateSelect(date)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateListText, isSelected && styles.dateListTextSelected]}>
                    {formatMMDDYY(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Footer buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.resetText}>Reset to all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.7}>
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  resetText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  applyText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
    color: Colors.bgPage,
  },
});
