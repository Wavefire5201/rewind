import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, FlipType } from 'expo-image-manipulator';
import { ArrowsLeftRight } from 'phosphor-react-native';
import { Colors, Fonts, Typography } from '@/constants/theme';
import PillButton from '@/components/ui/PillButton';
import CircleButton from '@/components/ui/CircleButton';
import { haptics } from '@/utils/haptics';

interface CapturePreviewProps {
  visible: boolean;
  imageUri: string;
  isFrontCamera: boolean;
  mirrorDefault: boolean;
  onSave: (caption: string, savedUri: string) => void;
  onRetake: () => void;
}

export default function CapturePreview({
  visible,
  imageUri,
  isFrontCamera,
  mirrorDefault,
  onSave,
  onRetake,
}: CapturePreviewProps) {
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [isMirrored, setIsMirrored] = useState(mirrorDefault);
  const { width } = useWindowDimensions();
  const photoHeight = (width - 48) * (4 / 3);

  // Reset mirror state when a new image arrives
  useEffect(() => {
    setIsMirrored(mirrorDefault);
  }, [imageUri, mirrorDefault]);

  const handleMirrorToggle = () => {
    haptics.tap();
    setIsMirrored(prev => !prev);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let finalUri = imageUri;

      // If front camera and NOT mirrored, flip the image horizontally to correct orientation
      if (isFrontCamera && !isMirrored) {
        const imageRef = await ImageManipulator.manipulate(imageUri)
          .flip(FlipType.Horizontal)
          .renderAsync();
        const saved = await imageRef.saveAsync();
        finalUri = saved.uri;
      }

      const filename = `rewind_${Date.now()}.jpg`;
      const src = new File(finalUri);
      const dest = new File(Paths.document, filename);
      src.copy(dest);
      haptics.success();
      onSave(caption, dest.uri);
      setCaption('');
    } catch {
      // If copy/flip fails fall back to original URI
      haptics.success();
      onSave(caption, imageUri);
      setCaption('');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    if (caption.trim().length > 0) {
      Alert.alert(
        'Discard caption?',
        'You have an unsaved caption. Retaking will discard it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retake',
            style: 'destructive',
            onPress: () => {
              setCaption('');
              onRetake();
            },
          },
        ],
      );
    } else {
      setCaption('');
      onRetake();
    }
  };

  // When front camera: mirror preview matches device-mirrored live view (scaleX: -1 = true orientation)
  const previewTransform = isFrontCamera && !isMirrored ? [{ scaleX: -1 as number }] : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <Image
          source={{ uri: imageUri }}
          style={[styles.photo, { width: width - 48, height: photoHeight }, previewTransform ? { transform: previewTransform } : null]}
          contentFit="cover"
        />

        {isFrontCamera && (
          <View style={styles.mirrorRow}>
            <CircleButton onPress={handleMirrorToggle} size={36} style={styles.mirrorButton}>
              <ArrowsLeftRight size={18} color={isMirrored ? Colors.accent : Colors.textTertiary} weight="bold" />
            </CircleButton>
            <Text style={styles.mirrorLabel}>
              {isMirrored ? 'mirrored' : 'true orientation'}
            </Text>
          </View>
        )}

        <TextInput
          value={caption}
          onChangeText={(text) => setCaption(text.slice(0, 140))}
          placeholder="Add a caption..."
          placeholderTextColor={Colors.textTertiary}
          style={styles.captionInput}
          multiline
        />
        <View style={styles.buttonRow}>
          <PillButton
            label={saving ? 'Saving…' : 'Save'}
            onPress={handleSave}
            variant="filled"
            style={styles.buttonFlex}
          />
          <PillButton label="Retake" onPress={handleRetake} variant="outlined" style={styles.buttonFlex} />
        </View>
      </SafeAreaView>
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
  mirrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  mirrorButton: {
    backgroundColor: Colors.bgCard ?? Colors.bgPage,
  },
  mirrorLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 12,
    color: Colors.textTertiary,
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
