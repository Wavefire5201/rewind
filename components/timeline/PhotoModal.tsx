import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  StyleSheet,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Trash, PencilSimple, Check } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { formatDateLabel, formatTime, getDayNumber } from '@/utils/dates';
import { getImageSource } from '@/utils/imageSource';
import { haptics } from '@/utils/haptics';
import type { PhotoEntry } from '@/types';

interface PhotoModalProps {
  visible: boolean;
  photos: PhotoEntry[];
  initialIndex: number;
  joinDate: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdateCaption: (id: string, caption: string) => void;
}

// ─── ZoomableImage ────────────────────────────────────────────────────────────

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
}

function ZoomableImage({ uri, width, height }: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image
          source={getImageSource(uri)}
          style={{ width, height }}
          contentFit="cover"
        />
      </Animated.View>
    </GestureDetector>
  );
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
}: PhotoModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  const translateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100) {
        translateY.value = withSpring(600, { damping: 20 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, 400], [1, 0]),
  }));

  const flatListRef = useRef<FlatList>(null);

  const photoWidth = screenWidth;
  const photoHeight = Math.min(screenWidth * (4 / 3), screenHeight * 0.55);

  // Sync index when modal opens with a (possibly new) initialIndex
  const handleVisible = useCallback(() => {
    translateY.value = 0;
    setCurrentIndex(initialIndex);
    setEditingCaption(false);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 0);
  }, [initialIndex]);

  const currentPhoto = photos[currentIndex] ?? null;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
        setEditingCaption(false);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });

  function handleDeletePress() {
    if (!currentPhoto) return;
    haptics.warning();
    Alert.alert(
      'Delete Photo',
      'This photo will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.success();
            onDelete(currentPhoto.id);
          },
        },
      ],
    );
  }

  function handleCaptionEditPress() {
    if (!currentPhoto) return;
    haptics.tap();
    setCaptionDraft(currentPhoto.caption ?? '');
    setEditingCaption(true);
  }

  function handleCaptionSave() {
    if (!currentPhoto) return;
    haptics.success();
    onUpdateCaption(currentPhoto.id, captionDraft.trim());
    setEditingCaption(false);
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
        {/* Tap-to-dismiss backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
              <Pressable
                style={styles.headerBtn}
                onPress={() => { haptics.tap(); onClose(); }}
                hitSlop={8}
              >
                <X size={20} color={Colors.textPrimary} weight="light" />
              </Pressable>
              <Pressable
                style={styles.headerBtn}
                onPress={handleDeletePress}
                hitSlop={8}
              >
                <Trash size={20} color="#E85D5D" weight="light" />
              </Pressable>
            </View>

            {/* Pager */}
            {photos.length > 0 && (
              <FlatList
                ref={flatListRef}
                data={photos}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={initialIndex}
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
                <Text style={[Typography.sectionLabel, styles.dateRow]}>
                  {formatDateLabel(currentPhoto.date)}
                  {'  ·  '}
                  {formatTime(currentPhoto.capturedAt)}
                  {'  ·  DAY '}
                  {getDayNumber(joinDate, currentPhoto.date)}
                </Text>

                {editingCaption ? (
                  <View style={styles.captionEditRow}>
                    <TextInput
                      style={styles.captionInput}
                      value={captionDraft}
                      onChangeText={setCaptionDraft}
                      placeholder="Add caption..."
                      placeholderTextColor={Colors.textTertiary}
                      autoFocus
                      multiline
                      returnKeyType="done"
                      onSubmitEditing={handleCaptionSave}
                    />
                    <Pressable onPress={handleCaptionSave} hitSlop={8} style={styles.captionAction}>
                      <Check size={18} color={Colors.accent} weight="bold" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={handleCaptionEditPress} style={styles.captionRow}>
                    <Text style={[Typography.caption, styles.captionText]}>
                      {currentPhoto.caption || 'Add caption...'}
                    </Text>
                    <PencilSimple size={14} color={Colors.textSecondary} weight="light" />
                  </Pressable>
                )}

                <Text style={[Typography.tiny, styles.pageIndicator]}>
                  {currentIndex + 1} / {photos.length}
                </Text>
              </View>
            )}

            {/* Bottom safe area spacer */}
            <View style={{ height: insets.bottom + 8 }} />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.bgSurface,
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
    paddingTop: 20,
    alignItems: 'center',
    gap: 10,
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
  captionAction: {
    paddingLeft: 8,
    paddingTop: 2,
  },
  pageIndicator: {
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
