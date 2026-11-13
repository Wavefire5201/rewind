import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Camera, Check, PencilSimple, ShareNetwork, Trash, ImageSquare } from 'phosphor-react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { formatDateLabel, formatTime } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import ZoomableImage from '@/components/ui/ZoomableImage';
import PillButton from '@/components/ui/PillButton';
import WeightField from '@/components/weight/WeightField';
import type { PhotoEntry, WeightEntry, WeightUnit, WeightValue } from '@/types';

/** The one caption limit, here and in the capture preview. */
export const CAPTION_MAX = 140;

export interface DayPageProps {
  date: string;
  /** Counted from the album's start. */
  dayNumber: number;
  isToday: boolean;
  photo: PhotoEntry | null;
  weight: WeightEntry | undefined;
  unit: WeightUnit;
  /** One line about the photo's face measurement, or null. */
  readout: string | null;
  use24h: boolean;
  width: number;
  photoHeight: number;
  /** Opens the weight field with the keyboard up ("+ log"). */
  focusWeight?: boolean;
  /** Today only: the camera. */
  onTakePhoto: () => void;
  /** Any day: one photo from the library onto this day (also replaces a past day's photo). */
  onAddFromLibrary: () => void;
  onShare: () => void;
  onDelete: () => void;
  onCaption: (caption: string) => void;
  onWeight: (weight: WeightValue | null) => void;
}

/** Everything about one day: its photo (or a way to add one), weight and caption. */
export default function DayPage({
  date, dayNumber, isToday, photo, weight, unit, readout, use24h, width, photoHeight, focusWeight,
  onTakePhoto, onAddFromLibrary, onShare, onDelete, onCaption, onWeight,
}: DayPageProps) {
  const { fonts, typography } = useFont();
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  function editCaption() {
    if (!photo) return;
    haptics.tap();
    setCaptionDraft(photo.caption ?? '');
    setEditingCaption(true);
  }

  function saveCaption() {
    haptics.success();
    onCaption(captionDraft.trim());
    setEditingCaption(false);
  }

  const action = (label: string, name: string, icon: React.ReactNode, onPress: () => void, danger = false) => (
    <Pressable style={styles.actionBtn} onPress={() => { haptics.tap(); onPress(); }} accessibilityLabel={name} accessibilityRole="button">
      {icon}
      <Text style={[styles.actionLabel, { fontFamily: fonts.regular }, danger && { color: Colors.danger }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAwareScrollView
      style={{ width }}
      contentContainerStyle={styles.content}
      bottomOffset={Spacing.xxl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typography.sectionLabel, styles.dateLine]}>
        {formatDateLabel(date)} · day {dayNumber}
      </Text>

      {photo ? (
        <View style={[styles.photo, { width, height: photoHeight }]}>
          <ZoomableImage uri={photo.imageUri} width={width} height={photoHeight} />
        </View>
      ) : (
        <View style={[styles.photo, styles.empty, { width, height: photoHeight }]}>
          {/* The frame is an inner overlay, not the slot's own border (Yoga sizes a bordered box differently). */}
          <View style={styles.emptyFrame} pointerEvents="none" />
          <ImageSquare size={32} color={Colors.textTertiary} weight="light" />
          <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>no photo for this day</Text>
          <View style={styles.emptyActions}>
            {isToday ? (
              <PillButton label="take photo" onPress={onTakePhoto} variant="filled" size="medium" accessibilityLabel="Take photo" />
            ) : null}
            <PillButton
              label="add from library"
              onPress={onAddFromLibrary}
              variant={isToday ? 'outlined' : 'filled'}
              size="medium"
              accessibilityLabel="Add photo from library"
            />
          </View>
        </View>
      )}

      <View style={styles.details}>
        {photo ? (
          <View style={styles.metaBlock}>
            <Text style={[typography.small, styles.meta]}>{formatTime(photo.capturedAt, use24h)}</Text>
            {readout ? <Text style={[typography.small, styles.meta]}>{readout}</Text> : null}
          </View>
        ) : null}

        <WeightField entry={weight} unit={unit} onCommit={onWeight} autoFocus={focusWeight} />

        {photo ? (
          editingCaption ? (
            <View style={styles.captionEditRow}>
              <TextInput
                style={[styles.captionInput, { fontFamily: fonts.regular }]}
                value={captionDraft}
                onChangeText={setCaptionDraft}
                placeholder="add a caption..."
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                multiline
                returnKeyType="done"
                onSubmitEditing={saveCaption}
                maxLength={CAPTION_MAX}
              />
              <Pressable onPress={saveCaption} hitSlop={12} style={styles.captionAction} accessibilityLabel="Save caption" accessibilityRole="button">
                <Check size={18} color={Colors.accent} weight="bold" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={editCaption} style={styles.captionRow} accessibilityLabel="Edit caption" accessibilityRole="button">
              <Text style={[typography.caption, styles.captionText, !photo.caption && { color: Colors.textTertiary }]}>
                {photo.caption || 'add a caption...'}
              </Text>
              <PencilSimple size={14} color={Colors.textSecondary} weight="light" />
            </Pressable>
          )
        ) : null}

        {photo ? (
          <View style={styles.actionRow}>
            {action('share', 'Share photo', <ShareNetwork size={22} color={Colors.textPrimary} weight="light" />, onShare)}
            {action('replace', 'Replace photo', <Camera size={22} color={Colors.textPrimary} weight="light" />, isToday ? onTakePhoto : onAddFromLibrary)}
            {action('delete', 'Delete photo', <Trash size={22} color={Colors.danger} weight="light" />, onDelete, true)}
          </View>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.xxxl },
  dateLine: { color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.md },
  photo: { overflow: 'hidden', backgroundColor: Colors.bgPage },
  empty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, backgroundColor: Colors.bgCard },
  emptyFrame: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1, borderColor: Colors.borderPrimary, borderStyle: 'dashed',
  },
  emptyText: { fontFamily: Fonts.mono.regular, fontSize: 12, color: Colors.textTertiary },
  emptyActions: { gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'stretch' },
  details: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, gap: Spacing.lg },
  metaBlock: { gap: 2 },
  meta: { color: Colors.textTertiary },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  captionText: { flexShrink: 1, color: Colors.textPrimary },
  captionEditRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingBottom: 4,
  },
  captionInput: { flex: 1, fontFamily: Fonts.mono.regular, fontSize: 16, lineHeight: 22, color: Colors.textPrimary },
  captionAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.sm },
  actionBtn: { alignItems: 'center', gap: 6, minWidth: 60 },
  actionLabel: { fontFamily: Fonts.mono.regular, fontSize: 10, color: Colors.textSecondary },
});
