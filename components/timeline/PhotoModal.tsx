import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import ZoomableImage from '@/components/ui/ZoomableImage';
import { X, Trash, PencilSimple, Check, ShareNetwork, Camera } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { formatDateLabel, formatTime, getDayNumber } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import type { PhotoEntry, WeightEntry, WeightUnit, WeightValue } from '@/types';
import { formatWeight, parseWeightInput, validRangeText, weightInputText } from '@/utils/weight';
import OverlayHost from '@/components/ui/overlay/OverlayHost';
import { confirm } from '@/utils/confirm';

interface PhotoModalProps {
  visible: boolean;
  photos: PhotoEntry[];
  initialIndex: number;
  joinDate: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdateCaption: (id: string, caption: string) => void;
  onRetake?: (albumId: string) => void;
  /** One line about the photo's face measurement, or null. */
  readout?: (photo: PhotoEntry) => string | null;
  /** The album's weight on a day; with onSetWeight, the viewer shows and edits it. */
  weightFor?: (date: string) => WeightEntry | undefined;
  unit?: WeightUnit;
  /** Sets the day's weight, or deletes it (null). */
  onSetWeight?: (date: string, weight: WeightValue | null) => void;
}

// ─── PhotoModal ───────────────────────────────────────────────────────────────

export default function PhotoModal({
  visible,
  photos,
  initialIndex,
  joinDate,
  onClose,
  onDelete,
  onUpdateCaption,
  onRetake,
  readout,
  weightFor,
  unit = 'kg',
  onSetWeight,
}: PhotoModalProps) {
  const { fonts, typography } = useFont();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [weightInvalid, setWeightInvalid] = useState(false);
  // 0 to minus the keyboard's height; tracked inside this Modal's own window.
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardLift = useAnimatedStyle(() => ({ transform: [{ translateY: keyboard.height.value }] }));

  const flatListRef = useRef<FlatList>(null);

  // Room for a 3:4 capture at full width; taller imported photos show whole (contain), narrower.
  const photoWidth = screenWidth;
  const photoHeight = Math.min(screenWidth * (4 / 3), screenHeight * 0.6);

  const safeInitialIndex = Math.max(0, Math.min(initialIndex, photos.length - 1));

  const handleVisible = useCallback(() => {
    const safeIdx = Math.max(0, Math.min(initialIndex, photos.length - 1));
    setCurrentIndex(safeIdx);
    setEditingCaption(false);
    setEditingWeight(false);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: safeIdx, animated: false });
    }, 0);
  }, [initialIndex, photos.length]);

  const currentPhoto = photos[currentIndex] ?? null;
  const currentReadout = currentPhoto && readout ? readout(currentPhoto) : null;
  const showWeight = Boolean(weightFor && onSetWeight);
  const currentWeight = currentPhoto && weightFor ? weightFor(currentPhoto.date) : undefined;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
        setEditingCaption(false);
        setEditingWeight(false);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });

  async function handleDeletePress() {
    if (!currentPhoto) return;
    const photo = currentPhoto;
    haptics.tap();
    const yes = await confirm({
      title: 'delete photo?',
      message: 'this photo will be permanently deleted.',
      confirmLabel: 'delete',
      destructive: true,
    });
    if (!yes) return;
    onDelete(photo.id);
    haptics.success();
  }

  function handleCaptionEditPress() {
    if (!currentPhoto) return;
    haptics.tap();
    setEditingWeight(false);
    setCaptionDraft(currentPhoto.caption ?? '');
    setEditingCaption(true);
  }

  function handleCaptionSave() {
    if (!currentPhoto) return;
    haptics.success();
    onUpdateCaption(currentPhoto.id, captionDraft.trim());
    setEditingCaption(false);
  }

  function handleWeightEditPress() {
    if (!currentPhoto) return;
    haptics.tap();
    setEditingCaption(false);
    setWeightDraft(currentWeight ? weightInputText(currentWeight, unit) : '');
    setWeightInvalid(false);
    setEditingWeight(true);
  }

  function handleWeightSave() {
    if (!currentPhoto || !onSetWeight) return;
    // Emptied: the day's weight goes.
    if (weightDraft.trim() === '') {
      if (currentWeight) {
        haptics.success();
        onSetWeight(currentPhoto.date, null);
      }
      setEditingWeight(false);
      return;
    }
    // Untouched: keep the entry as it was entered, rather than re-storing a rounded conversion.
    if (currentWeight && weightDraft.trim() === weightInputText(currentWeight, unit)) {
      setEditingWeight(false);
      return;
    }
    const weight = parseWeightInput(weightDraft, unit);
    if (!weight) {
      haptics.error();
      setWeightInvalid(true);
      return;
    }
    haptics.success();
    onSetWeight(currentPhoto.date, weight);
    setEditingWeight(false);
  }

  async function handleShare() {
    if (!currentPhoto) return;
    haptics.tap();
    try {
      const { shareAsync } = await import('expo-sharing');
      await shareAsync(currentPhoto.imageUri);
    } catch (e) {
      console.warn('Share failed:', e);
    }
  }

  function handleRetake() {
    if (!currentPhoto || !onRetake) return;
    haptics.tap();
    onClose();
    onRetake(currentPhoto.albumId);
  }

  const renderItem = useCallback(
    ({ item }: { item: PhotoEntry }) => (
      <View style={[styles.page, { width: photoWidth }]}>
        <View style={[styles.imageContainer, { width: photoWidth, height: photoHeight }]}>
          <ZoomableImage uri={item.imageUri} width={photoWidth} height={photoHeight} />
        </View>
      </View>
    ),
    [photoWidth, photoHeight],
  );

  const keyExtractor = useCallback((item: PhotoEntry) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      onShow={handleVisible}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* Backdrop */}
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none" />

        {/* Tap-to-dismiss: fills the whole screen behind the content */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { haptics.tap(); onClose(); }} accessibilityLabel="Close photo viewer" accessibilityRole="button" />

        {/* Content. Rides up with the keyboard, so the caption being edited stays in sight: the
            bottom row lands just above the keyboard, the caption above it. */}
        <Animated.View testID="photo-viewer-content" style={[styles.content, keyboardLift]} pointerEvents="box-none">
          {/* Close button */}
          <View style={[styles.closeRow, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => { haptics.tap(); onClose(); }}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X size={20} color={Colors.textSecondary} weight="light" />
            </Pressable>
          </View>

          {/* Pager — vertically centered via justifyContent */}
          {photos.length > 0 && (
              <FlatList
                ref={flatListRef}
                data={photos}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={safeInitialIndex}
                getItemLayout={(_, index) => ({
                  length: photoWidth,
                  offset: photoWidth * index,
                  index,
                })}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig.current}
                style={styles.pager}
              />
            )}

            {/* Metadata + caption */}
            {currentPhoto && (
              <View style={styles.meta}>
                <Text style={[typography.sectionLabel, styles.dateRow]}>
                  {formatDateLabel(currentPhoto.date)}
                  {'  ·  '}
                  {formatTime(currentPhoto.capturedAt)}
                  {'  ·  day '}
                  {getDayNumber(joinDate, currentPhoto.date)}
                </Text>
                {currentReadout ? (
                  <Text style={[typography.small, styles.readout]}>{currentReadout}</Text>
                ) : null}

                {showWeight ? (
                  editingWeight ? (
                    <>
                      <View style={[styles.captionEditRow, styles.weightEditRow]}>
                        <TextInput
                          style={[styles.captionInput, { fontFamily: fonts.regular }]}
                          value={weightDraft}
                          onChangeText={(v) => { setWeightDraft(v); if (weightInvalid) setWeightInvalid(false); }}
                          placeholder={`weight (${unit})`}
                          placeholderTextColor={Colors.textTertiary}
                          keyboardType="decimal-pad"
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={handleWeightSave}
                          maxLength={6}
                          accessibilityLabel={`Weight in ${unit}`}
                        />
                        <Pressable
                          onPress={handleWeightSave}
                          hitSlop={12}
                          style={styles.captionAction}
                          accessibilityLabel="Save weight"
                          accessibilityRole="button"
                        >
                          <Check size={18} color={Colors.accent} weight="bold" />
                        </Pressable>
                      </View>
                      {weightInvalid ? (
                        <Text style={[typography.small, styles.weightError]}>enter a weight between {validRangeText(unit)}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Pressable
                      onPress={handleWeightEditPress}
                      style={styles.captionRow}
                      accessibilityLabel={currentWeight ? 'Edit weight' : 'Add weight'}
                      accessibilityRole="button"
                    >
                      <Text style={[typography.small, { color: currentWeight ? Colors.textPrimary : Colors.textTertiary }]}>
                        {currentWeight ? formatWeight(currentWeight, unit) : 'add weight'}
                      </Text>
                    </Pressable>
                  )
                ) : null}

                {editingCaption ? (
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
                      onSubmitEditing={handleCaptionSave}
                      maxLength={200}
                    />
                    <Pressable
                      onPress={handleCaptionSave}
                      hitSlop={12}
                      style={styles.captionAction}
                      accessibilityLabel="Save caption"
                      accessibilityRole="button"
                    >
                      <Check size={18} color={Colors.accent} weight="bold" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleCaptionEditPress}
                    style={styles.captionRow}
                    accessibilityLabel="Edit caption"
                    accessibilityRole="button"
                  >
                    <Text style={[typography.caption, styles.captionText]}>
                      {currentPhoto.caption || 'add a caption...'}
                    </Text>
                    <PencilSimple size={14} color={Colors.textSecondary} weight="light" />
                  </Pressable>
                )}

              </View>
            )}

          {/* Action toolbar — pinned to bottom */}
          {currentPhoto && (
            <View style={[styles.actionRow, { bottom: insets.bottom + 12 }]}>
              <Pressable style={styles.actionBtn} onPress={handleShare} accessibilityLabel="Share photo" accessibilityRole="button">
                <ShareNetwork size={22} color={Colors.textPrimary} weight="light" />
                <Text style={[styles.actionLabel, { fontFamily: fonts.regular }]}>share</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={handleRetake} accessibilityLabel="Retake photo" accessibilityRole="button">
                <Camera size={22} color={Colors.textPrimary} weight="light" />
                <Text style={[styles.actionLabel, { fontFamily: fonts.regular }]}>retake</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={handleDeletePress} accessibilityLabel="Delete photo" accessibilityRole="button">
                <Trash size={22} color={Colors.danger} weight="light" />
                <Text style={[styles.actionLabel, { fontFamily: fonts.regular, color: Colors.danger }]}>delete</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
        <OverlayHost />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  closeRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flexGrow: 0,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    overflow: 'hidden',
  },
  meta: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  readout: {
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  dateRow: {
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  captionText: {
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  captionEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingBottom: 4,
    width: '100%',
  },
  captionInput: {
    flex: 1,
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  weightEditRow: {
    width: 160,
    alignItems: 'center',
  },
  weightError: {
    color: Colors.danger,
    textAlign: 'center',
  },
  captionAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  actionLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
