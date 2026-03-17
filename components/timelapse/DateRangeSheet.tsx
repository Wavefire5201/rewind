import React, { useState, useEffect } from 'react';
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
  dates: string[];       // all dates with photos (YYYY-MM-DD format)
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

function formatMMDD(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function formatDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setSelStart(startDate);
      setSelEnd(endDate);
      setSelecting(null);
    }
  }, [visible, startDate, endDate]);

  function handleDateTap(date: string) {
    haptics.tap();
    if (selecting === null || selecting === 'start') {
      setSelStart(date);
      setSelEnd(date);
      setSelecting('end');
    } else {
      // selecting === 'end'
      if (date < selStart) {
        setSelEnd(selStart);
        setSelStart(date);
      } else {
        setSelEnd(date);
      }
      setSelecting(null);
    }
  }

  function handleReset() {
    haptics.tap();
    if (dates.length > 0) {
      setSelStart(dates[0]);
      setSelEnd(dates[dates.length - 1]);
      setSelecting(null);
    }
  }

  function handleApply() {
    haptics.success();
    onApply(selStart, selEnd);
  }

  function chipStyle(date: string) {
    const isStart = date === selStart;
    const isEnd = date === selEnd;
    const inRange = date >= selStart && date <= selEnd;

    if (isStart || isEnd) {
      return [styles.chip, styles.chipEndpoint];
    }
    if (inRange) {
      return [styles.chip, styles.chipInRange];
    }
    return [styles.chip];
  }

  function chipTextStyle(date: string) {
    const isStart = date === selStart;
    const isEnd = date === selEnd;
    const inRange = date >= selStart && date <= selEnd;

    if (isStart || isEnd) {
      return [styles.chipText, styles.chipTextEndpoint];
    }
    if (inRange) {
      return [styles.chipText, styles.chipTextInRange];
    }
    return [styles.chipText];
  }

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
          <Text style={styles.title}>Select Date Range</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={20} color={Colors.textSecondary} weight="light" />
          </TouchableOpacity>
        </View>

        {/* Range display */}
        <View style={styles.rangeRow}>
          <Text style={styles.rangeText}>
            {selStart === selEnd
              ? formatDisplay(selStart)
              : `${formatDisplay(selStart)} — ${formatDisplay(selEnd)}`}
          </Text>
          {selecting === 'end' && (
            <Text style={styles.hintText}>tap another date to set end</Text>
          )}
        </View>

        {/* Date grid */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {dates.map((date) => (
            <TouchableOpacity
              key={date}
              style={chipStyle(date)}
              onPress={() => handleDateTap(date)}
              activeOpacity={0.7}
            >
              <Text style={chipTextStyle(date)}>{formatMMDD(date)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  rangeRow: {
    marginBottom: 16,
    gap: 4,
  },
  rangeText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.accent,
  },
  hintText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  scrollView: {
    maxHeight: 220,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.bgSurface,
    minWidth: 60,
    alignItems: 'center',
  },
  chipEndpoint: {
    backgroundColor: Colors.accent,
  },
  chipInRange: {
    backgroundColor: Colors.accentDeep,
  },
  chipText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  chipTextEndpoint: {
    color: Colors.bgPage,
  },
  chipTextInRange: {
    color: Colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
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
