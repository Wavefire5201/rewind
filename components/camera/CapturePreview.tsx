import React, { useState } from 'react';
import { View, TextInput, Modal, StyleSheet, useWindowDimensions } from 'react-native';
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

interface CapturePreviewProps {
  visible: boolean;
  imageUri: string;
  onSave: (caption: string, savedUri: string) => void;
  onRetake: () => void;
  /** Asked before anything is written (e.g. "replace today's photo?"); false keeps the preview open. */
  confirmSave?: () => Promise<boolean>;
}

export default function CapturePreview({
  visible,
  imageUri,
  onSave,
  onRetake,
  confirmSave,
}: CapturePreviewProps) {
  const { fonts } = useFont();
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();
  const photoHeight = (width - 48) * (4 / 3);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Confirm before copying, so a declined save leaves no stray copy behind.
      if (confirmSave && !(await confirmSave())) return;
      const filename = `rewind_${Date.now()}.jpg`;
      const src = new File(imageUri);
      const dest = new File(Paths.document, filename);
      await src.copy(dest);
      haptics.success();
      onSave(caption, dest.uri);
      setCaption('');
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
      </SafeAreaView>
      <OverlayHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  buttonFlex: {
    flex: 1,
  },
});
