import React, { useState } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import PillButton from '@/components/ui/PillButton';
import { haptics } from '@/utils/haptics';
import { cachePolicyFor } from '@/utils/imageSource';
import OverlayHost from '@/components/ui/overlay/OverlayHost';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { parseWeightInput, validRangeText } from '@/utils/weight';
import type { WeightUnit, WeightValue } from '@/types';

/** Room kept under the focused caption: the save/retake row (24 margin, ~40 tall) and a gap. */
const BUTTON_ROW_CLEARANCE = 80;

interface CapturePreviewProps {
  visible: boolean;
  imageUri: string;
  /** `weight` is null when the field was left blank. */
  onSave: (caption: string, savedUri: string, weight: WeightValue | null) => void;
  onRetake: () => void;
  /** Asked before anything is written (e.g. "replace today's photo?"); false keeps the preview open. */
  confirmSave?: () => Promise<boolean>;
  /** The unit the optional weight field takes. */
  weightUnit: WeightUnit;
  /** The field's starting text, e.g. today's weight when retaking. */
  initialWeight?: string;
}

export default function CapturePreview({
  visible,
  imageUri,
  onSave,
  onRetake,
  confirmSave,
  weightUnit,
  initialWeight = '',
}: CapturePreviewProps) {
  const { fonts } = useFont();
  const [caption, setCaption] = useState('');
  const [weightText, setWeightText] = useState(initialWeight);
  const [weightInvalid, setWeightInvalid] = useState(false);

  // Each opening starts from the day's weight (set while rendering, not in an effect, so the
  // first frame already shows it).
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const opening = visible ? initialWeight : null;
  if (opening !== openedWith) {
    setOpenedWith(opening);
    if (opening !== null) {
      setWeightText(opening);
      setWeightInvalid(false);
    }
  }
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();
  const photoHeight = (width - 48) * (4 / 3);

  const handleSave = async () => {
    if (saving) return;
    // Blank skips the weight; anything else has to be one before the photo is written.
    const weight = weightText.trim() === '' ? null : parseWeightInput(weightText, weightUnit);
    if (weightText.trim() !== '' && !weight) {
      setWeightInvalid(true);
      haptics.error();
      return;
    }
    setSaving(true);
    try {
      // Confirm before copying, so a declined save leaves no stray copy behind.
      if (confirmSave && !(await confirmSave())) return;
      const filename = `rewind_${Date.now()}.jpg`;
      const src = new File(imageUri);
      const dest = new File(Paths.document, filename);
      await src.copy(dest);
      haptics.success();
      onSave(caption, dest.uri, weight);
      setCaption('');
      setWeightText('');
    } catch {
      notify({ title: 'save failed', message: "couldn't save photo, please try again.", tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = async () => {
    if (caption.trim().length > 0) {
      const yes = await confirm({
        title: 'discard caption?',
        message: 'you have an unsaved caption. retaking will discard it.',
        confirmLabel: 'retake',
        destructive: true,
      });
      if (!yes) return;
    }
    setCaption('');
    onRetake();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        {/* Scrolls the caption, and the buttons under it, above the keyboard. keyboard-controller
            tracks this Modal's own window, which RN's Keyboard can't. */}
        <KeyboardAwareScrollView
          testID="capture-preview-scroll"
          contentContainerStyle={styles.content}
          bottomOffset={BUTTON_ROW_CLEARANCE}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri: imageUri }}
            cachePolicy={cachePolicyFor(imageUri)}
            style={[styles.photo, { width: width - 48, height: photoHeight }]}
            contentFit="cover"
          />

          <TextInput
            value={caption}
            onChangeText={(text) => setCaption(text.slice(0, 140))}
            placeholder="add a caption..."
            placeholderTextColor={Colors.textTertiary}
            style={[styles.captionInput, { fontFamily: fonts.regular }]}
            multiline
          />
          <View style={styles.weightRow}>
            <TextInput
              value={weightText}
              onChangeText={(text) => { setWeightText(text); if (weightInvalid) setWeightInvalid(false); }}
              placeholder="weight (optional)"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              maxLength={6}
              style={[styles.weightInput, { fontFamily: fonts.regular }]}
              accessibilityLabel={`Weight in ${weightUnit}, optional`}
            />
            <Text style={[styles.weightUnit, { fontFamily: fonts.regular }]}>{weightUnit}</Text>
          </View>
          {weightInvalid ? (
            <Text style={[styles.weightError, { fontFamily: fonts.regular }]}>
              enter a weight between {validRangeText(weightUnit)}, or leave it blank
            </Text>
          ) : null}
          <View style={styles.buttonRow}>
            <PillButton
              label={saving ? 'saving…' : 'save'}
              onPress={handleSave}
              variant="filled"
              style={styles.buttonFlex}
              // Saving ends in its own success (or error) haptic.
              haptic={false}
            />
            <PillButton label="retake" onPress={handleRetake} variant="outlined" style={styles.buttonFlex} />
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
      <OverlayHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  photo: {
    borderRadius: 0,
    marginTop: 16,
  },
  captionInput: {
    width: '100%',
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderColor: Colors.borderPrimary,
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    padding: 16,
  },
  weightRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: Colors.borderPrimary,
    paddingRight: 16,
  },
  weightInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    padding: 16,
  },
  weightUnit: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  weightError: {
    alignSelf: 'flex-start',
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.danger,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  buttonFlex: {
    flex: 1,
  },
});
