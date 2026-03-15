import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '@/constants/theme';
import { formatDateLabel, formatTime } from '@/utils/dates';
import { getImageSource } from '@/utils/imageSource';
import type { PhotoEntry } from '@/types';

interface PhotoModalProps {
  visible: boolean;
  photo: PhotoEntry | null;
  onClose: () => void;
}

export default function PhotoModal({ visible, photo, onClose }: PhotoModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const PHOTO_WIDTH = screenWidth - 40;
  const PHOTO_HEIGHT = PHOTO_WIDTH * (4 / 3);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Close button */}
        <Pressable
          style={[styles.closeButton, { top: insets.top + 16 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
        >
          <X size={24} color={Colors.textPrimary} weight="light" />
        </Pressable>

        {photo && (
          <Pressable onPress={() => {}} style={styles.contentWrapper}>
            {/* Photo */}
            <View style={[styles.photoWrapper, { width: PHOTO_WIDTH, height: PHOTO_HEIGHT }]}>
              <Image
                source={getImageSource(photo.imageUri)}
                style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
                contentFit="cover"
              />
            </View>

            {/* Info below photo */}
            <Text style={[Typography.sectionLabel, styles.dateLabel]}>
              {formatDateLabel(photo.date)}
            </Text>
            {photo.caption ? (
              <Text style={[Typography.caption, styles.caption]}>{photo.caption}</Text>
            ) : null}
            <Text style={[Typography.small, styles.time]}>
              {formatTime(photo.capturedAt)}
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  photoWrapper: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  dateLabel: {
    color: Colors.textPrimary,
    marginTop: 16,
    alignSelf: 'center',
  },
  caption: {
    color: Colors.textPrimary,
    marginTop: 8,
    textAlign: 'center',
  },
  time: {
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
