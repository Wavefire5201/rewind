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
import { X } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

export interface ImportPhotoModalProps {
  visible: boolean;
  photos: { uri: string; suggestedDate: string }[];
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ImportPhotoModal({
  visible,
  photos,
  onSave,
  onCancel,
}: ImportPhotoModalProps) {
  const { fonts } = useFont();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [date, setDate] = useState('');
  const [caption, setCaption] = useState('');
  const [entries, setEntries] = useState<{ uri: string; date: string; caption: string }[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const photoHeight = Math.round((screenWidth - 48) * (4 / 3));

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setEntries([]);
      setCaption('');
      setShowDatePicker(false);
      if (photos.length > 0) {
        setDate(photos[0].suggestedDate || dateToStr(new Date()));
      }
    }
  }, [visible, photos]);

  useEffect(() => {
    if (photos[currentIndex]) {
      setDate(photos[currentIndex].suggestedDate || dateToStr(new Date()));
      setCaption('');
      setShowDatePicker(false);
    }
  }, [currentIndex]);

  const current = photos[currentIndex];
  const total = photos.length;
  const isLast = currentIndex === total - 1;

  function handleDateChange(_event: unknown, selectedDate?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setDate(dateToStr(selectedDate));
    }
  }

  function handleSaveNext() {
    haptics.tap();
    const newEntry = { uri: current.uri, date, caption: caption.trim() };
    const updatedEntries = [...entries, newEntry];

    if (isLast) {
      haptics.success();
      onSave(updatedEntries);
    } else {
      setEntries(updatedEntries);
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
          <Text style={[styles.headerTitle, { fontFamily: fonts.regular }]}>Import Photo</Text>
          <Text style={[styles.counter, { fontFamily: fonts.regular }]}>
            {currentIndex + 1} / {total}
          </Text>
          <Pressable onPress={handleCancel} hitSlop={12} style={styles.closeBtn}>
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
            <Image
              source={{ uri: current.uri }}
              style={[styles.photo, { width: screenWidth - 48, height: photoHeight }]}
              contentFit="cover"
            />
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            {/* Date */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { fontFamily: fonts.regular }]}>DATE</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => { haptics.tap(); setShowDatePicker(prev => !prev); }}
              >
                <Text style={[styles.dateButtonText, { fontFamily: fonts.regular }]}>
                  {formatDisplayDate(date)}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={dateStrToDate(date)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  themeVariant="dark"
                  maximumDate={new Date()}
                />
              )}
            </View>

            {/* Caption */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { fontFamily: fonts.regular }]}>CAPTION</Text>
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

        {/* Save button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSaveNext}
          >
            <Text style={[styles.saveBtnText, { fontFamily: fonts.medium }]}>
              {isLast ? 'Save' : 'Save & Next  →'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  photo: {},
  fields: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textSecondary,
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
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnPressed: {
    backgroundColor: Colors.accentDeep,
  },
  saveBtnText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    color: Colors.bgPage,
    letterSpacing: 0.5,
  },
});
