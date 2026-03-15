import React, { useState } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { Colors, Fonts, Typography } from '@/constants/theme';
import PillButton from '@/components/ui/PillButton';

interface CapturePreviewProps {
  visible: boolean;
  imageUri: string;
  onSave: (caption: string, savedUri: string) => void;
  onRetake: () => void;
}

export default function CapturePreview({ visible, imageUri, onSave, onRetake }: CapturePreviewProps) {
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();
  const photoHeight = (width - 48) * (4 / 3);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const filename = `rewind_${Date.now()}.jpg`;
      const src = new File(imageUri);
      const dest = new File(Paths.document, filename);
      src.copy(dest);
      onSave(caption, dest.uri);
      setCaption('');
    } catch {
      // If copy fails fall back to original URI
      onSave(caption, imageUri);
      setCaption('');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    setCaption('');
    onRetake();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <Image
          source={{ uri: imageUri }}
          style={[styles.photo, { width: width - 48, height: photoHeight }]}
          contentFit="cover"
        />
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
