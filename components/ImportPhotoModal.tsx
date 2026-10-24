import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { X, CaretLeft } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import SectionLabel from '@/components/ui/SectionLabel';
import PillButton from '@/components/ui/PillButton';
import { cachePolicyFor } from '@/utils/imageSource';
import OverlayHost from '@/components/ui/overlay/OverlayHost';
import DatePickerSheet from '@/components/ui/DatePickerSheet';
import { getToday } from '@/utils/dates';

export interface ImportPhotoModalProps {
  visible: boolean;
  photos: { uri: string; suggestedDate: string }[];
  /** Days this album already has a photo for: dotted in the date picker. */
  photoDates: ReadonlySet<string>;
  onSave: (entries: { uri: string; date: string; caption: string }[]) => void;
  onCancel: () => void;
}

function dateStrToDate(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return new Date();
  return date;
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(str: string): string {
  const d = dateStrToDate(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
}

export default function ImportPhotoModal({
  visible,
  photos,
  photoDates,
  onSave,
  onCancel,
}: ImportPhotoModalProps) {
  const { fonts } = useFont();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Indexed per-photo state: keyed by original photo index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoStates, setPhotoStates] = useState<Record<number, { date: string; caption: string }>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Derived fields for the current photo (hydrated from saved state or photo suggestion)
  const currentSaved = photoStates[currentIndex];
  const date = currentSaved?.date ?? (photos[currentIndex]?.suggestedDate || dateToStr(new Date()));
  const caption = currentSaved?.caption ?? '';

  function setDate(d: string) {
    setPhotoStates(prev => ({
      ...prev,
      [currentIndex]: {
        date: d,
        caption: prev[currentIndex]?.caption ?? '',
      },
    }));
  }

  function setCaption(c: string) {
    setPhotoStates(prev => ({
      ...prev,
      [currentIndex]: {
        date: prev[currentIndex]?.date ?? (photos[currentIndex]?.suggestedDate || dateToStr(new Date())),
        caption: c,
      },
    }));
  }

  const photoHeight = Math.round((screenWidth - 48) * (4 / 3));

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setPhotoStates({});
      setSkipped(new Set());
      setShowDatePicker(false);
    }
  }, [visible, photos]);

  // Close date picker when navigating
  useEffect(() => {
    setShowDatePicker(false);
  }, [currentIndex]);

  const current = photos[currentIndex];
  const total = photos.length;
  const isLast = currentIndex === total - 1;

  function handleDatePicked(picked: string) {
    setDate(picked);
    setShowDatePicker(false);
  }

  function handleSaveNext() {
    // One tap per press. The last one starts the import, whose result notice plays the success.
    haptics.tap();
    // Persist current state before advancing
    const currentDate = photoStates[currentIndex]?.date ?? (photos[currentIndex]?.suggestedDate || dateToStr(new Date()));
    const currentCaption = photoStates[currentIndex]?.caption ?? '';
    const updatedStates = { ...photoStates, [currentIndex]: { date: currentDate, caption: currentCaption } };
    setPhotoStates(updatedStates);

    if (isLast) {
      // Collect all non-skipped entries in original order
      const result = photos
        .map((p, i) => {
          if (skipped.has(i)) return null;
          const s = updatedStates[i];
          return { uri: p.uri, date: s?.date ?? (p.suggestedDate || dateToStr(new Date())), caption: s?.caption?.trim() ?? '' };
        })
        .filter((e): e is { uri: string; date: string; caption: string } => e !== null);
      onSave(result);
    } else {
      // Advance to next non-skipped index (or just next index)
      setCurrentIndex(prev => prev + 1);
    }
  }

  function handleBack() {
    haptics.tap();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }

  function handleSkip() {
    haptics.tap();
    const newSkipped = new Set(skipped);
    newSkipped.add(currentIndex);
    setSkipped(newSkipped);

    if (isLast) {
      // Collect all non-skipped entries including previously saved
      const result = photos
        .map((p, i) => {
          if (newSkipped.has(i)) return null;
          const s = photoStates[i];
          return { uri: p.uri, date: s?.date ?? (p.suggestedDate || dateToStr(new Date())), caption: s?.caption?.trim() ?? '' };
        })
        .filter((e): e is { uri: string; date: string; caption: string } => e !== null);
      onSave(result);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }

  function handleCancel() {
    haptics.tap();
    onCancel();
  }

  if (!current) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: Colors.bgPage }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {currentIndex > 0 ? (
            <Pressable onPress={handleBack} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Go back" accessibilityRole="button">
              <CaretLeft size={20} color={Colors.textPrimary} weight="light" />
            </Pressable>
          ) : (
            <View style={styles.closeBtn} />
          )}
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { fontFamily: fonts.regular }]}>import photo</Text>
            <Text style={[styles.counter, { fontFamily: fonts.regular }]}>
              {currentIndex + 1} / {total}
            </Text>
          </View>
          <Pressable
            onPress={handleCancel}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel import"
          >
            <X size={20} color={Colors.textPrimary} weight="light" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          <View style={styles.photoContainer}>
            <View style={[styles.photoPlaceholder, { width: screenWidth - 48, height: photoHeight }]}>
              <Image
                source={{ uri: current.uri }}
                cachePolicy={cachePolicyFor(current.uri)}
                style={[styles.photo, { width: screenWidth - 48, height: photoHeight }]}
                contentFit="cover"
                onError={() => {}}
              />
            </View>
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            {/* Date */}
            <View style={styles.fieldGroup}>
              <SectionLabel>date</SectionLabel>
              <Pressable
                style={styles.dateButton}
                onPress={() => { haptics.tap(); setShowDatePicker(true); }}
                accessibilityRole="button"
                accessibilityLabel="Change date"
                accessibilityValue={{ text: formatDisplayDate(date) }}
              >
                <Text style={[styles.dateButtonText, { fontFamily: fonts.regular }]}>
                  {formatDisplayDate(date)}
                </Text>
              </Pressable>
              <DatePickerSheet
                visible={showDatePicker}
                value={date}
                maxDate={getToday()}
                photoDates={photoDates}
                onConfirm={handleDatePicked}
                onClose={() => setShowDatePicker(false)}
              />
            </View>

            {/* Caption */}
            <View style={styles.fieldGroup}>
              <SectionLabel>caption</SectionLabel>
              <TextInput
                style={[styles.input, styles.captionInput, { fontFamily: fonts.regular }]}
                value={caption}
                onChangeText={setCaption}
                placeholder="add a caption..."
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
                multiline
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PillButton
            label={isLast ? 'save' : 'save & next  →'}
            onPress={handleSaveNext}
            size="large"
            haptic={false}
          />
          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            onPress={handleSkip}
            accessibilityLabel="Skip this photo"
            accessibilityRole="button"
          >
            <Text style={[styles.skipBtnText, { fontFamily: fonts.regular }]}>skip</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <OverlayHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  counter: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  photoContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  photoPlaceholder: {
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  photo: {},
  fields: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  dateButton: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    paddingVertical: 10,
  },
  dateButtonText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.accent,
  },
  input: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderPrimary,
    paddingVertical: 10,
  },
  captionInput: {
    minHeight: 44,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDivider,
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});
