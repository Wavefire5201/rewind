# Critical QoL Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 14 critical quality-of-life improvements to make the Rewind app feel polished and complete.

**Architecture:** Incremental additions to the existing React Context + AsyncStorage architecture. New utilities (`haptics.ts`, `notifications.ts`, `export.ts`, `import.ts`) keep logic out of components. PhotoModal gets the biggest refactor (zoom, swipe, edit, delete). Export uses a zip-based backup format to avoid OOM.

**Tech Stack:** Expo SDK 55, Expo Router v4, TypeScript, React Native Gesture Handler, Reanimated, expo-image-manipulator, jszip, gifenc

**Spec:** `docs/superpowers/specs/2026-03-16-critical-qol-design.md`

---

## Chunk 1: Foundation & Camera Flow

### Task 1: Install Dependencies & Configure Plugins

**Files:**
- Modify: `package.json`
- Modify: `app.json`

- [ ] **Step 1: Install new dependencies**

Run:
```bash
bun add expo-sharing expo-document-picker expo-image-manipulator jszip gifenc expo-media-library
```

- [ ] **Step 2: Add plugin entries to app.json**

In `app.json`, add to the `plugins` array (after the existing `expo-notifications` entry):

```json
[
  "expo-media-library",
  {
    "photosPermission": "Allow Rewind to save photos and timelapses to your library.",
    "savePhotosPermission": "Allow Rewind to save photos and timelapses to your library."
  }
],
"expo-document-picker"
```

- [ ] **Step 3: Verify the app still starts**

Run:
```bash
bun run start
```

Expected: Metro bundler starts without errors. Press `i` to verify iOS simulator loads.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lockb app.json
git commit -m "chore: add dependencies for QoL features (export, import, sharing)"
```

---

### Task 2: Haptics Utility

**Files:**
- Create: `utils/haptics.ts`

- [ ] **Step 1: Create the haptics utility**

```typescript
// utils/haptics.ts
import * as Haptics from 'expo-haptics';

export const haptics = {
  /** Photo capture — medium impact */
  shutter: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Button press, tab switch — light impact */
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Photo saved, export complete — success notification */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Delete confirmation — warning notification */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),

  /** Permission denied, failed action — error notification */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run:
```bash
bunx tsc --noEmit --pretty
```

Expected: No errors related to `utils/haptics.ts`.

- [ ] **Step 3: Commit**

```bash
git add utils/haptics.ts
git commit -m "feat: add semantic haptics utility"
```

---

### Task 3: Settings Migration & Mirror Toggle Type

**Files:**
- Modify: `types/index.ts` (line 16-21)
- Modify: `utils/storage.ts` (lines 10-17, 41-44)

- [ ] **Step 1: Add `mirrorSelfies` to AppSettings type**

In `types/index.ts`, add to the `AppSettings` interface:

```typescript
export interface AppSettings {
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  photoQuality: 'low' | 'medium' | 'high';
  cloudBackupEnabled: boolean;
  mirrorSelfies: boolean;
}
```

- [ ] **Step 2: Update `getDefaultSettings()` in storage.ts**

```typescript
export function getDefaultSettings(): AppSettings {
  return {
    reminderEnabled: true,
    reminderTime: '08:00',
    photoQuality: 'high',
    cloudBackupEnabled: false,
    mirrorSelfies: true,
  };
}
```

- [ ] **Step 3: Add settings merge to `loadSettings()`**

Replace `loadSettings()` in `utils/storage.ts`:

```typescript
export async function loadSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!data) return getDefaultSettings();
  const stored = JSON.parse(data) as Partial<AppSettings>;
  return { ...getDefaultSettings(), ...stored };
}
```

This merges stored settings with defaults, so existing users get new fields like `mirrorSelfies: true` without losing their existing values.

- [ ] **Step 4: Verify no TypeScript errors**

Run:
```bash
bunx tsc --noEmit --pretty
```

Expected: Clean — all existing code already uses `Partial<AppSettings>` for updates.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts utils/storage.ts
git commit -m "feat: add mirrorSelfies setting with migration-safe loadSettings"
```

---

### Task 4: Mirror Toggle in CapturePreview

**Files:**
- Modify: `components/camera/CapturePreview.tsx`
- Modify: `app/(tabs)/camera.tsx` (lines 78-90, 129-134)

- [ ] **Step 1: Update CapturePreview props and add mirror state**

In `components/camera/CapturePreview.tsx`, update the interface and component:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';
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

export default function CapturePreview({ visible, imageUri, isFrontCamera, mirrorDefault, onSave, onRetake }: CapturePreviewProps) {
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [isMirrored, setIsMirrored] = useState(mirrorDefault);
  const { width } = useWindowDimensions();
  const photoHeight = (width - 48) * (4 / 3);

  // Reset mirror state when new image loads
  useEffect(() => {
    setIsMirrored(mirrorDefault);
  }, [imageUri, mirrorDefault]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let finalUri = imageUri;

      // If front camera and NOT mirrored, flip the image to true orientation
      // CameraView captures front camera as mirrored by default
      if (isFrontCamera && !isMirrored) {
        const result = await ImageManipulator.manipulate(imageUri)
          .flip(FlipType.Horizontal)
          .renderAsync();
        finalUri = result.uri;
      }

      const filename = `rewind_${Date.now()}.jpg`;
      const src = new File(finalUri);
      const dest = new File(Paths.document, filename);
      src.copy(dest);
      haptics.success();
      onSave(caption, dest.uri);
      setCaption('');
    } catch {
      onSave(caption, imageUri);
      setCaption('');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    if (caption.trim().length > 0) {
      const { Alert } = require('react-native');
      Alert.alert(
        'Discard caption?',
        'You have an unsaved caption. Discard and retake?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => { setCaption(''); onRetake(); } },
        ]
      );
    } else {
      setCaption('');
      onRetake();
    }
  };

  const toggleMirror = () => {
    haptics.tap();
    setIsMirrored(prev => !prev);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.photo,
            { width: width - 48, height: photoHeight },
            // Show visual preview of mirror state
            isFrontCamera && !isMirrored && { transform: [{ scaleX: -1 }] },
          ]}
          contentFit="cover"
        />

        {/* Mirror toggle — only for front camera */}
        {isFrontCamera && (
          <View style={styles.mirrorRow}>
            <CircleButton
              icon={<ArrowsLeftRight size={20} color={isMirrored ? Colors.accent : Colors.textSecondary} weight="regular" />}
              onPress={toggleMirror}
              size={40}
            />
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
  },
  mirrorLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
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
```

- [ ] **Step 2: Update camera.tsx to pass new props**

In `app/(tabs)/camera.tsx`, update the `CapturePreview` usage. Add settings access:

After the existing `usePhotos` and `useGreeting` hooks (~line 16-17), add:
```typescript
const { settings } = useAppContext();
```

And add the import:
```typescript
import { useAppContext } from '@/context/AppContext';
```

Update the `CapturePreview` component (~line 129-134):
```typescript
<CapturePreview
  visible={showPreview}
  imageUri={capturedUri}
  isFrontCamera={facing === 'front'}
  mirrorDefault={settings.mirrorSelfies}
  onSave={handleSave}
  onRetake={handleRetake}
/>
```

- [ ] **Step 3: Test in simulator**

1. Open camera tab
2. Take a selfie with front camera
3. Verify mirror toggle button appears
4. Toggle it and see preview flip
5. Save — verify saved image matches the preview
6. Switch to back camera, take photo — verify no mirror toggle appears
7. Type a caption, tap Retake — verify confirmation alert appears

- [ ] **Step 4: Commit**

```bash
git add components/camera/CapturePreview.tsx app/\(tabs\)/camera.tsx
git commit -m "feat: add mirror toggle for selfies + retake confirmation"
```

---

### Task 5: Wire Up Photo Quality Setting

**Files:**
- Modify: `app/(tabs)/camera.tsx` (line 33)

- [ ] **Step 1: Add quality mapping and apply to capture**

In `app/(tabs)/camera.tsx`, add a quality map constant near the top (after imports):

```typescript
const QUALITY_MAP: Record<string, number> = {
  low: 0.5,
  medium: 0.7,
  high: 1.0,
};
```

Then update `doCapture()` (line ~33):

```typescript
const doCapture = async () => {
  const quality = QUALITY_MAP[settings.photoQuality] ?? 0.8;
  const photo = await cameraRef.current?.takePictureAsync({ quality });
  if (photo?.uri) {
    setCapturedUri(photo.uri);
    setShowPreview(true);
  }
};
```

Note: `settings` is already available from Task 4's `useAppContext()` addition.

- [ ] **Step 2: Test in simulator**

1. Go to Profile > Settings > Photo Quality, cycle to "Low"
2. Take a photo — should capture successfully
3. Cycle to "High" — take another photo
4. Both should work, high quality image should be visibly sharper/larger file

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/camera.tsx
git commit -m "feat: wire photo quality setting to camera capture"
```

---

## Chunk 2: Photo Modal Refactor (View, Edit, Delete, Zoom, Swipe)

### Task 6: Add `deletePhoto` File Cleanup + `importPhotos` to AppContext

**Files:**
- Modify: `context/AppContext.tsx` (lines 79-85)

- [ ] **Step 1: Update deletePhoto to clean up image file**

In `context/AppContext.tsx`, add the import at top:
```typescript
import * as FileSystem from 'expo-file-system';
```

Replace the `deletePhoto` callback (~line 79):

```typescript
const deletePhoto = useCallback((id: string) => {
  setPhotos(prev => {
    const target = prev.find(p => p.id === id);
    // Clean up image file from disk
    if (target?.imageUri && target.imageUri.startsWith('file://')) {
      FileSystem.deleteAsync(target.imageUri, { idempotent: true }).catch(() => {});
    }
    const next = prev.filter(p => p.id !== id);
    savePhotos(next);
    return next;
  });
}, []);
```

- [ ] **Step 2: Verify no TypeScript errors**

Run:
```bash
bunx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add context/AppContext.tsx
git commit -m "feat: add file cleanup to deletePhoto + importPhotos method"
```

---

### Task 7: Refactor PhotoModal — Swipe, Zoom, Metadata, Edit Caption, Delete

This is the largest single task. The existing `PhotoModal` is a simple single-photo view. We're replacing it with a full-featured photo viewer.

**Files:**
- Modify: `components/timeline/PhotoModal.tsx` (full rewrite)
- Modify: `app/album/[id].tsx` (lines 26-27, 54-59, 95-102)

- [ ] **Step 1: Rewrite PhotoModal**

Replace `components/timeline/PhotoModal.tsx` entirely:

```typescript
import React, { useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, FlatList, Alert,
  StyleSheet, useWindowDimensions, type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Trash, PencilSimple, Check } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  GestureDetector, Gesture, GestureHandlerRootView,
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

function ZoomableImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .minPointers(1)
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

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Exclusive(doubleTap, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
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

export default function PhotoModal({
  visible, photos, initialIndex, joinDate, onClose, onDelete, onUpdateCaption,
}: PhotoModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const PHOTO_WIDTH = screenWidth;
  const PHOTO_HEIGHT = PHOTO_WIDTH * (4 / 3);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const currentPhoto = photos[currentIndex] ?? null;

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
      setEditingCaption(false);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleDelete = () => {
    if (!currentPhoto) return;
    haptics.warning();
    Alert.alert(
      'Delete photo?',
      'This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(currentPhoto.id);
            if (photos.length <= 1) {
              onClose();
            }
          },
        },
      ],
    );
  };

  const startEditCaption = () => {
    if (!currentPhoto) return;
    haptics.tap();
    setCaptionDraft(currentPhoto.caption);
    setEditingCaption(true);
  };

  const saveCaption = () => {
    if (!currentPhoto) return;
    onUpdateCaption(currentPhoto.id, captionDraft);
    setEditingCaption(false);
    haptics.success();
  };

  const renderItem = ({ item }: { item: PhotoEntry }) => (
    <View style={{ width: screenWidth, alignItems: 'center', justifyContent: 'center' }}>
      <ZoomableImage uri={item.imageUri} width={PHOTO_WIDTH - 40} height={PHOTO_HEIGHT} />
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop]}>
          {/* Header buttons */}
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.headerButton} onPress={() => { haptics.tap(); onClose(); }}>
              <X size={22} color={Colors.textPrimary} weight="light" />
            </Pressable>
            <View style={styles.headerRight}>
              <Pressable style={styles.headerButton} onPress={handleDelete}>
                <Trash size={22} color="#E85D5D" weight="light" />
              </Pressable>
            </View>
          </View>

          {/* Photo pager */}
          <FlatList
            ref={flatListRef}
            data={photos}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />

          {/* Info below photo */}
          {currentPhoto && (
            <View style={[styles.infoArea, { paddingBottom: insets.bottom + 16 }]}>
              {/* Metadata */}
              <Text style={[Typography.sectionLabel, styles.dateLabel]}>
                {formatDateLabel(currentPhoto.date)}
                {'  ·  '}
                {formatTime(currentPhoto.capturedAt)}
                {'  ·  '}
                Day {getDayNumber(joinDate, currentPhoto.date)}
              </Text>

              {/* Editable caption */}
              {editingCaption ? (
                <View style={styles.captionEditRow}>
                  <TextInput
                    value={captionDraft}
                    onChangeText={(t) => setCaptionDraft(t.slice(0, 140))}
                    style={styles.captionInput}
                    autoFocus
                    multiline
                    placeholder="Add caption..."
                    placeholderTextColor={Colors.textTertiary}
                    onSubmitEditing={saveCaption}
                  />
                  <Pressable onPress={saveCaption} style={styles.captionSaveBtn}>
                    <Check size={20} color={Colors.accent} weight="bold" />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={startEditCaption} style={styles.captionTouchable}>
                  <Text style={[Typography.caption, styles.caption]}>
                    {currentPhoto.caption || 'Add caption...'}
                  </Text>
                  <PencilSimple size={14} color={Colors.textTertiary} weight="light" />
                </Pressable>
              )}

              {/* Page indicator */}
              <Text style={[Typography.tiny, styles.pageIndicator]}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  dateLabel: {
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  caption: {
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  captionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  captionEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captionInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    borderBottomWidth: 1,
    borderColor: Colors.accent,
    paddingVertical: 4,
  },
  captionSaveBtn: {
    padding: 8,
  },
  pageIndicator: {
    textAlign: 'center',
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Update album/[id].tsx to pass new PhotoModal props**

In `app/album/[id].tsx`:

Add `updatePhoto` and `deletePhoto` to the destructured context:
```typescript
const { profile, updatePhoto, deletePhoto } = useAppContext();
```

Replace the `selectedPhoto` / `modalVisible` state (~line 26-27):
```typescript
const [modalVisible, setModalVisible] = useState(false);
const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
```

Update `handleDayPress` (~line 54):
```typescript
function handleDayPress(date: string) {
  const index = monthPhotos.findIndex(p => p.date === date);
  if (index >= 0) {
    setSelectedPhotoIndex(index);
    setModalVisible(true);
  }
}
```

Replace the `PhotoModal` usage (~line 95-102):
```typescript
<PhotoModal
  visible={modalVisible}
  photos={monthPhotos}
  initialIndex={selectedPhotoIndex}
  joinDate={profile.joinDate}
  onClose={() => setModalVisible(false)}
  onDelete={(id) => { deletePhoto(id); if (monthPhotos.length <= 1) setModalVisible(false); }}
  onUpdateCaption={(id, caption) => updatePhoto(id, { caption })}
/>
```

- [ ] **Step 3: Test in simulator**

1. Go to Albums > daily selfie > tap a day with a photo
2. Verify photo modal opens with date, time, day number
3. Swipe left/right between photos in the month
4. Pinch-to-zoom on a photo, double-tap to zoom in/out
5. Tap the caption to edit it, type new text, tap checkmark to save
6. Close and reopen — verify caption persisted
7. Tap trash icon — verify confirmation alert
8. Confirm delete — verify photo removed and modal updates

- [ ] **Step 4: Commit**

```bash
git add components/timeline/PhotoModal.tsx app/album/\[id\].tsx
git commit -m "feat: refactor PhotoModal with swipe, zoom, caption edit, delete, metadata"
```

---

## Chunk 3: Timelapse — Date Range & Export

### Task 8: Date Range Selector

**Files:**
- Create: `components/timelapse/DateRangeSheet.tsx`
- Modify: `app/(tabs)/timelapse.tsx`

- [ ] **Step 1: Create DateRangeSheet component**

```typescript
// components/timelapse/DateRangeSheet.tsx
import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { formatDateLabel } from '@/utils/dates';
import { haptics } from '@/utils/haptics';

interface DateRangeSheetProps {
  visible: boolean;
  dates: string[]; // all available dates with photos
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

export default function DateRangeSheet({ visible, dates, startDate, endDate, onApply, onClose }: DateRangeSheetProps) {
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  const handleDateTap = (date: string) => {
    haptics.tap();
    if (!start || (start && end)) {
      // Starting new selection
      setStart(date);
      setEnd(date);
    } else {
      // Setting end date
      if (date < start) {
        setEnd(start);
        setStart(date);
      } else {
        setEnd(date);
      }
    }
  };

  const handleApply = () => {
    haptics.success();
    onApply(start, end);
    onClose();
  };

  const handleReset = () => {
    haptics.tap();
    setStart(dates[0]);
    setEnd(dates[dates.length - 1]);
  };

  const isInRange = (date: string) => date >= start && date <= end;
  const isEndpoint = (date: string) => date === start || date === end;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={Typography.body}>Select Date Range</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textPrimary} weight="light" />
            </Pressable>
          </View>

          <Text style={[Typography.small, styles.rangeLabel]}>
            {formatDateLabel(start)} — {formatDateLabel(end)}
          </Text>

          <ScrollView style={styles.dateList} showsVerticalScrollIndicator={false}>
            <View style={styles.dateGrid}>
              {dates.map((date) => (
                <Pressable
                  key={date}
                  onPress={() => handleDateTap(date)}
                  style={[
                    styles.dateChip,
                    isInRange(date) && styles.dateChipInRange,
                    isEndpoint(date) && styles.dateChipEndpoint,
                  ]}
                >
                  <Text style={[
                    styles.dateChipText,
                    isInRange(date) && styles.dateChipTextActive,
                  ]}>
                    {date.slice(5)} {/* MM-DD */}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable onPress={handleReset} style={styles.resetBtn}>
              <Text style={[Typography.small, { color: Colors.textSecondary }]}>Reset to all</Text>
            </Pressable>
            <Pressable onPress={handleApply} style={styles.applyBtn}>
              <Text style={[Typography.body, { color: Colors.bgPage }]}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 8,
  },
  rangeLabel: {
    textAlign: 'center',
    marginTop: 12,
    color: Colors.accent,
  },
  dateList: {
    marginTop: 16,
    maxHeight: 300,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.bgSurface,
  },
  dateChipInRange: {
    backgroundColor: Colors.accentDeep,
  },
  dateChipEndpoint: {
    backgroundColor: Colors.accent,
  },
  dateChipText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  dateChipTextActive: {
    color: Colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  resetBtn: {
    padding: 12,
  },
  applyBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
```

- [ ] **Step 2: Add date range state to timelapse.tsx**

In `app/(tabs)/timelapse.tsx`, add imports and state:

```typescript
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
```

Inside the component, after `const playerRef = ...` (~line 17), add:

```typescript
const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
const [showDateRange, setShowDateRange] = useState(false);

// Filter photos by date range
const filteredPhotos = dateRange
  ? photos.filter(p => p.date >= dateRange.start && p.date <= dateRange.end)
  : photos;

const allDates = photos.map(p => p.date);
const rangeStart = dateRange?.start ?? (photos[0]?.date ?? '');
const rangeEnd = dateRange?.end ?? (photos[photos.length - 1]?.date ?? '');
```

Update the empty state check to use `filteredPhotos`:
```typescript
if (filteredPhotos.length < 2) {
```

Replace all `photos` references in the JSX with `filteredPhotos` (TimelapsePlayer, Scrubber, Filmstrip).

Add a date range pill button in the header row (after the export button):
```typescript
<TouchableOpacity
  style={styles.exportButton}
  onPress={() => { haptics.tap(); setShowDateRange(true); }}
  activeOpacity={0.7}
>
  <Text style={styles.exportLabel}>
    {rangeStart.slice(5)} — {rangeEnd.slice(5)}
  </Text>
</TouchableOpacity>
```

Add the DateRangeSheet before the closing `</SafeAreaView>`:
```typescript
<DateRangeSheet
  visible={showDateRange}
  dates={allDates}
  startDate={rangeStart}
  endDate={rangeEnd}
  onApply={(start, end) => setDateRange({ start, end })}
  onClose={() => setShowDateRange(false)}
/>
```

Import `haptics`:
```typescript
import { haptics } from '@/utils/haptics';
```

- [ ] **Step 3: Test in simulator**

1. Go to Timelapse tab
2. Tap the date range pill
3. Select a start and end date
4. Tap Apply — verify timelapse only plays photos in that range
5. Verify scrubber and filmstrip update to show only filtered photos
6. Tap "Reset to all" — verify all photos return

- [ ] **Step 4: Commit**

```bash
git add components/timelapse/DateRangeSheet.tsx app/\(tabs\)/timelapse.tsx
git commit -m "feat: add date range selector for timelapse"
```

---

### Task 9: Export System

**Files:**
- Create: `utils/export.ts`
- Create: `components/timelapse/ExportSheet.tsx`
- Create: `components/timelapse/ExportProgress.tsx`
- Modify: `app/(tabs)/timelapse.tsx`

- [ ] **Step 1: Create export utility**

```typescript
// utils/export.ts
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import JSZip from 'jszip';
import type { PhotoEntry } from '@/types';

const EXPORT_DIR = FileSystem.cacheDirectory + 'rewind-export/';

type ProgressCallback = (current: number, total: number) => void;
type CancelToken = { cancelled: boolean };

async function ensureExportDir() {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
}

async function cleanupExportDir() {
  try {
    await FileSystem.deleteAsync(EXPORT_DIR, { idempotent: true });
  } catch {}
}

export async function exportToPhotoAlbum(
  photos: PhotoEntry[],
  onProgress: ProgressCallback,
  cancel: CancelToken,
): Promise<void> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Permission denied');

  let album = await MediaLibrary.getAlbumAsync('Rewind');

  for (let i = 0; i < photos.length; i++) {
    if (cancel.cancelled) throw new Error('Cancelled');
    const asset = await MediaLibrary.createAssetAsync(photos[i].imageUri);
    if (!album) {
      album = await MediaLibrary.createAlbumAsync('Rewind', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
    onProgress(i + 1, photos.length);
  }
}

export async function exportToGif(
  photos: PhotoEntry[],
  speed: number,
  onProgress: ProgressCallback,
  cancel: CancelToken,
): Promise<string> {
  await ensureExportDir();
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const TARGET_WIDTH = 480;
  const delay = Math.round(1000 / (4 * speed)); // 4fps base, adjusted by speed

  // First pass: resize all frames
  const frames: { width: number; height: number; uri: string }[] = [];
  for (let i = 0; i < Math.min(photos.length, 500); i++) {
    if (cancel.cancelled) { await cleanupExportDir(); throw new Error('Cancelled'); }
    const result = await ImageManipulator.manipulate(photos[i].imageUri)
      .resize({ width: TARGET_WIDTH })
      .renderAsync();
    frames.push({ width: TARGET_WIDTH, height: Math.round(TARGET_WIDTH * 4 / 3), uri: result.uri });
    onProgress(i + 1, photos.length * 2); // first half is resize
  }

  // We'll use a simplified approach — save frames as images and let the user share
  // Full GIF encoding requires canvas which is complex in RN
  // For now, export as individual frames in a zip (same as backup but without metadata)
  // TODO: Implement proper GIF encoding with canvas or native module

  const outputPath = EXPORT_DIR + `rewind-timelapse-${Date.now()}.gif`;
  // Placeholder — in production, use gifenc with a canvas context
  // For now, fall through to photo album export
  onProgress(photos.length * 2, photos.length * 2);
  return outputPath;
}

export async function exportToBackup(
  photos: PhotoEntry[],
  albumName: string,
  onProgress: ProgressCallback,
  cancel: CancelToken,
): Promise<string> {
  await ensureExportDir();
  const zip = new JSZip();
  const imagesFolder = zip.folder('images')!;

  const manifest = {
    version: 1,
    exportDate: new Date().toISOString(),
    album: albumName,
    photos: [] as { id: string; date: string; caption: string; imageFile: string }[],
  };

  for (let i = 0; i < photos.length; i++) {
    if (cancel.cancelled) { await cleanupExportDir(); throw new Error('Cancelled'); }
    const photo = photos[i];
    const filename = `${photo.date}.jpg`;

    // Read image as base64 and add to zip
    const base64 = await FileSystem.readAsStringAsync(photo.imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    imagesFolder.file(filename, base64, { base64: true });

    manifest.photos.push({
      id: photo.id,
      date: photo.date,
      caption: photo.caption,
      imageFile: `images/${filename}`,
    });

    onProgress(i + 1, photos.length + 1);
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const content = await zip.generateAsync({ type: 'base64' });
  const outputPath = EXPORT_DIR + `rewind-backup-${Date.now()}.rewind`;
  await FileSystem.writeAsStringAsync(outputPath, content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  onProgress(photos.length + 1, photos.length + 1);
  return outputPath;
}

export async function shareFile(filePath: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath);
  }
}

export { cleanupExportDir };
```

- [ ] **Step 2: Create ExportSheet component**

```typescript
// components/timelapse/ExportSheet.tsx
import React from 'react';
import { View, Text, Modal, Pressable, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Images, FilmStrip, FolderOpen, DownloadSimple, X } from 'phosphor-react-native';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

export type ExportFormat = 'album' | 'backup' | 'gif' | 'mp4';

interface ExportSheetProps {
  visible: boolean;
  onSelect: (format: ExportFormat) => void;
  onClose: () => void;
}

const OPTIONS: { format: ExportFormat; label: string; description: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { format: 'album', label: 'Photo Album', description: 'Save frames to camera roll', icon: <FolderOpen size={22} color={Colors.textPrimary} weight="light" /> },
  { format: 'backup', label: 'Rewind Backup', description: 'Importable .rewind file', icon: <DownloadSimple size={22} color={Colors.textPrimary} weight="light" /> },
  { format: 'gif', label: 'Animated GIF', description: 'Coming soon', icon: <Images size={22} color={Colors.textTertiary} weight="light" />, comingSoon: true },
  { format: 'mp4', label: 'MP4 Video', description: 'Coming soon (requires dev build)', icon: <FilmStrip size={22} color={Colors.textTertiary} weight="light" />, comingSoon: true },
];

export default function ExportSheet({ visible, onSelect, onClose }: ExportSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={Typography.body}>Export Timelapse</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textPrimary} weight="light" />
            </Pressable>
          </View>

          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.format}
              style={({ pressed }) => [styles.option, pressed && !opt.comingSoon && { opacity: 0.7 }, opt.comingSoon && { opacity: 0.4 }]}
              onPress={() => {
                if (opt.comingSoon) {
                  haptics.tap();
                  Alert.alert('Coming Soon', `${opt.label} export will be available in a future update.`);
                  return;
                }
                haptics.tap();
                onSelect(opt.format);
              }}
            >
              {opt.icon}
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: { padding: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: Colors.borderDivider,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  optionDesc: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
```

- [ ] **Step 3: Create ExportProgress component**

```typescript
// components/timelapse/ExportProgress.tsx
import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { X } from 'phosphor-react-native';
import { Colors, Fonts, Typography } from '@/constants/theme';

interface ExportProgressProps {
  visible: boolean;
  label: string;
  current: number;
  total: number;
  onCancel: () => void;
}

export default function ExportProgress({ visible, label, current, total, onCancel }: ExportProgressProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={[Typography.body, styles.label]}>{label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={[Typography.small, styles.pctText]}>{pct}% — {current}/{total}</Text>
          <Pressable onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  label: { color: Colors.textPrimary },
  barTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.accent,
  },
  pctText: { color: Colors.textSecondary },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: '#E85D5D',
  },
});
```

- [ ] **Step 4: Wire export into timelapse.tsx**

In `app/(tabs)/timelapse.tsx`, add imports:
```typescript
import ExportSheet, { type ExportFormat } from '@/components/timelapse/ExportSheet';
import ExportProgress from '@/components/timelapse/ExportProgress';
import { exportToPhotoAlbum, exportToBackup, shareFile, cleanupExportDir } from '@/utils/export';
```

Add state after the existing state declarations:
```typescript
const [showExportSheet, setShowExportSheet] = useState(false);
const [exporting, setExporting] = useState(false);
const [exportLabel, setExportLabel] = useState('');
const [exportCurrent, setExportCurrent] = useState(0);
const [exportTotal, setExportTotal] = useState(0);
const cancelRef = useRef({ cancelled: false });
```

Replace `handleExport`:
```typescript
function handleExport() {
  haptics.tap();
  setShowExportSheet(true);
}

async function handleExportFormat(format: ExportFormat) {
  setShowExportSheet(false);
  setExporting(true);
  cancelRef.current = { cancelled: false };
  const progress = (c: number, t: number) => { setExportCurrent(c); setExportTotal(t); };

  try {
    switch (format) {
      case 'album': {
        setExportLabel('Saving to Photo Album...');
        await exportToPhotoAlbum(filteredPhotos, progress, cancelRef.current);
        haptics.success();
        Alert.alert('Saved', `${filteredPhotos.length} photos saved to "Rewind" album.`);
        break;
      }
      case 'backup': {
        setExportLabel('Creating backup...');
        const path = await exportToBackup(filteredPhotos, 'daily-selfie', progress, cancelRef.current);
        haptics.success();
        await shareFile(path);
        break;
      }
      // GIF and MP4 are handled as "Coming Soon" in ExportSheet — no case needed here
    }
  } catch (e: any) {
    if (e.message !== 'Cancelled') {
      haptics.error();
      Alert.alert('Export Failed', e.message);
    }
  } finally {
    setExporting(false);
    await cleanupExportDir();
  }
}

function handleCancelExport() {
  cancelRef.current.cancelled = true;
  setExporting(false);
}
```

Add the modals before closing `</SafeAreaView>`:
```typescript
<ExportSheet
  visible={showExportSheet}
  onSelect={handleExportFormat}
  onClose={() => setShowExportSheet(false)}
/>
<ExportProgress
  visible={exporting}
  label={exportLabel}
  current={exportCurrent}
  total={exportTotal}
  onCancel={handleCancelExport}
/>
```

- [ ] **Step 5: Test in simulator**

1. Go to Timelapse tab, tap Export
2. Verify action sheet shows 3 options (GIF, Photo Album, Backup)
3. Select "Photo Album" — verify permission prompt, then progress bar, then success
4. Select "Rewind Backup" — verify progress, then share sheet appears
5. Cancel during export — verify it stops and cleans up

- [ ] **Step 6: Commit**

```bash
git add utils/export.ts components/timelapse/ExportSheet.tsx components/timelapse/ExportProgress.tsx app/\(tabs\)/timelapse.tsx
git commit -m "feat: add timelapse export (photo album, backup, GIF placeholder)"
```

---

## Chunk 4: Import, Empty States, Notifications, Haptics Polish

### Task 10: Import System

**Files:**
- Create: `utils/import.ts`
- Modify: `app/album/[id].tsx`

- [ ] **Step 1: Create import utility**

```typescript
// utils/import.ts
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import JSZip from 'jszip';
import type { PhotoEntry } from '@/types';

export async function pickPhotosFromLibrary(): Promise<{ uri: string; date: string | null }[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
    exif: true,
  });

  if (result.canceled) return [];

  return result.assets.map(asset => ({
    uri: asset.uri,
    date: asset.exif?.DateTimeOriginal
      ? new Date(asset.exif.DateTimeOriginal).toISOString().split('T')[0]
      : null,
  }));
}

export async function importFromBackup(): Promise<PhotoEntry[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return [];

  const fileUri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(content, { base64: true });
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Invalid backup: no manifest.json found');

  const manifestText = await manifestFile.async('string');
  const manifest = JSON.parse(manifestText);

  const photos: PhotoEntry[] = [];
  for (const entry of manifest.photos) {
    const imageFile = zip.file(entry.imageFile);
    if (!imageFile) continue;

    const imageBase64 = await imageFile.async('base64');
    const filename = `rewind_import_${Date.now()}_${entry.date}.jpg`;
    const destPath = Paths.document + '/' + filename;
    await FileSystem.writeAsStringAsync(destPath, imageBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    photos.push({
      id: `import_${Date.now()}_${entry.date}`,
      date: entry.date,
      imageUri: destPath,
      caption: entry.caption || '',
      capturedAt: new Date().toISOString(),
      cameraDirection: 'front',
    });
  }

  return photos;
}

export function createPhotoEntry(uri: string, date: string, caption: string = ''): PhotoEntry {
  const filename = `rewind_import_${Date.now()}.jpg`;
  try {
    const src = new File(uri);
    const dest = new File(Paths.document, filename);
    src.copy(dest);
    return {
      id: `import_${Date.now()}_${date}`,
      date,
      imageUri: dest.uri,
      caption,
      capturedAt: new Date().toISOString(),
      cameraDirection: 'front',
    };
  } catch {
    return {
      id: `import_${Date.now()}_${date}`,
      date,
      imageUri: uri,
      caption,
      capturedAt: new Date().toISOString(),
      cameraDirection: 'front',
    };
  }
}
```

- [ ] **Step 2: Add import button to album detail screen**

In `app/album/[id].tsx`, add imports:
```typescript
import { DownloadSimple } from 'phosphor-react-native';
import { pickPhotosFromLibrary, importFromBackup, createPhotoEntry } from '@/utils/import';
import { haptics } from '@/utils/haptics';
import { Alert } from 'react-native';
import { getToday } from '@/utils/dates';
```

Add `addPhoto` to the destructured context:
```typescript
const { profile, updatePhoto, deletePhoto, addPhoto } = useAppContext();
```

Add import handler inside the component:
```typescript
async function handleImport() {
  haptics.tap();
  Alert.alert('Import Photos', 'Choose import source', [
    {
      text: 'Camera Roll',
      onPress: async () => {
        try {
          const picked = await pickPhotosFromLibrary();
          if (picked.length === 0) return;
          for (const item of picked) {
            const date = item.date ?? getToday();
            const existing = photos.find(p => p.date === date);
            if (existing) {
              // Simple conflict: skip if exists for now
              continue;
            }
            const entry = createPhotoEntry(item.uri, date);
            addPhoto(entry);
          }
          haptics.success();
          Alert.alert('Imported', `Photos imported successfully.`);
        } catch (e: any) {
          haptics.error();
          Alert.alert('Import Failed', e.message);
        }
      },
    },
    {
      text: 'Rewind Backup',
      onPress: async () => {
        try {
          const entries = await importFromBackup();
          if (entries.length === 0) return;
          for (const entry of entries) {
            const existing = photos.find(p => p.date === entry.date);
            if (existing) continue; // skip conflicts
            addPhoto(entry);
          }
          haptics.success();
          Alert.alert('Imported', `${entries.length} photos restored from backup.`);
        } catch (e: any) {
          haptics.error();
          Alert.alert('Import Failed', e.message);
        }
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
```

Add the import button to the header (after the back button, before the title):
```typescript
<View style={styles.header}>
  <Pressable onPress={() => { haptics.tap(); router.back(); }} hitSlop={12} style={styles.backBtn}>
    <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
  </Pressable>
  <Text style={styles.title}>{albumName}</Text>
  <Pressable onPress={handleImport} hitSlop={12} style={styles.backBtn}>
    <DownloadSimple size={20} color={Colors.textPrimary} weight="regular" />
  </Pressable>
</View>
```

Remove the empty spacer `<View style={styles.backBtn} />` that was there before.

- [ ] **Step 3: Test in simulator**

1. Go to Albums > daily selfie
2. Tap the import icon in header
3. Select "Camera Roll" — pick some photos — verify they appear in calendar
4. Test with a .rewind backup file if available

- [ ] **Step 4: Commit**

```bash
git add utils/import.ts app/album/\[id\].tsx
git commit -m "feat: add photo import from camera roll and .rewind backup"
```

---

### Task 11: Empty State Component + Integration

**Files:**
- Create: `components/ui/EmptyState.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/timelapse.tsx`
- Modify: `app/(tabs)/albums.tsx`

- [ ] **Step 1: Create EmptyState component**

```typescript
// components/ui/EmptyState.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts, Typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon, message, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.message}>{message}</Text>
      {ctaLabel && onCta && (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.7 }]}
          onPress={() => { haptics.tap(); onCta(); }}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  message: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  cta: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent,
  },
  ctaText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.bgPage,
  },
});
```

- [ ] **Step 2: Add empty state to Home screen**

In `app/(tabs)/index.tsx`, add imports:
```typescript
import { usePhotos } from '@/hooks/usePhotos';
import { useRouter } from 'expo-router';
import { Camera } from 'phosphor-react-native';
import EmptyState from '@/components/ui/EmptyState';
```

Inside the component, add:
```typescript
const { totalPhotos } = usePhotos();
const router = useRouter();

if (totalPhotos === 0) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <EmptyState
        icon={<Camera size={48} color={Colors.textTertiary} weight="light" />}
        message="Take your first photo to start your journey"
        ctaLabel="Open Camera"
        onCta={() => router.push('/(tabs)/camera')}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Update timelapse empty state**

In `app/(tabs)/timelapse.tsx`, replace the existing empty state block (~lines 44-54) with:

```typescript
import EmptyState from '@/components/ui/EmptyState';
```

```typescript
if (filteredPhotos.length < 2) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <EmptyState
        icon={<Camera size={48} color={Colors.textTertiary} weight="light" />}
        message={photos.length < 2
          ? 'Take at least 2 photos to create your timelapse'
          : 'No photos in selected date range'}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Add empty state to albums screen**

In `app/(tabs)/albums.tsx`, add imports:
```typescript
import { Camera } from 'phosphor-react-native';
import EmptyState from '@/components/ui/EmptyState';
import { useAppContext } from '@/context/AppContext';
```

Inside the component, add:
```typescript
const { photos } = useAppContext();
```

Before the return statement, add an early return for empty state:
```typescript
if (photos.length === 0) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>albums</Text>
      </View>
      <EmptyState
        icon={<Camera size={48} color={Colors.textTertiary} weight="light" />}
        message="No albums yet. Take your first photo to get started."
        ctaLabel="Open Camera"
        onCta={() => router.push('/(tabs)/camera')}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Test empty states**

Set `USE_MOCK_DATA` to `false` in `constants/mockData.ts`, clear AsyncStorage, and verify:
1. Home shows empty state with camera CTA
2. Timelapse shows "take at least 2 photos" message
3. Albums shows "No albums yet" with CTA
4. After taking 1 photo, home shows normally, timelapse still shows empty

Re-enable mock data after testing.

- [ ] **Step 6: Commit**

```bash
git add components/ui/EmptyState.tsx app/\(tabs\)/index.tsx app/\(tabs\)/timelapse.tsx app/\(tabs\)/albums.tsx
git commit -m "feat: add empty states for home, timelapse, and albums screens"
```

---

### Task 12: Notifications Utility

**Files:**
- Create: `utils/notifications.ts`
- Modify: `components/profile/SettingsList.tsx`

- [ ] **Step 1: Create notifications utility**

```typescript
// utils/notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_MESSAGES = [
  "Time for today's photo!",
  "Don't break your streak!",
  "Capture this moment.",
  "Your future self will thank you.",
  "One photo, one day.",
];

function getRandomMessage(): string {
  return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(timeStr: string): Promise<void> {
  // Cancel existing reminders first
  await cancelAllReminders();

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rewind',
      body: getRandomMessage(),
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

- [ ] **Step 2: Wire up SettingsList**

In `components/profile/SettingsList.tsx`, add imports:
```typescript
import { requestNotificationPermission, scheduleDailyReminder, cancelAllReminders } from '@/utils/notifications';
import { haptics } from '@/utils/haptics';
```

Replace the Daily Reminder row with a pressable toggle:
```typescript
{/* Row 1: Daily Reminder — toggles on/off */}
<Pressable
  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
  onPress={async () => {
    haptics.tap();
    const newEnabled = !settings.reminderEnabled;
    if (newEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable notifications in Settings to use reminders.');
        return;
      }
      await scheduleDailyReminder(settings.reminderTime);
    } else {
      await cancelAllReminders();
    }
    updateSettings({ reminderEnabled: newEnabled });
  }}
>
  <View style={styles.left}>
    <BellSimple size={20} color={settings.reminderEnabled ? Colors.accent : Colors.textSecondary} weight="light" />
    <Text style={styles.rowLabel}>Daily Reminder</Text>
  </View>
  <Text style={styles.rowValue}>
    {settings.reminderEnabled ? formatReminderTime(settings.reminderTime) : 'Off'}
  </Text>
</Pressable>
```

Add the `Alert` import if not already present.

- [ ] **Step 3: Test on simulator**

1. Go to Profile > Settings
2. Tap "Daily Reminder" to toggle on — verify permission prompt
3. Grant permission — verify it shows the time
4. Tap again to toggle off — verify it shows "Off"

- [ ] **Step 4: Commit**

```bash
git add utils/notifications.ts components/profile/SettingsList.tsx
git commit -m "feat: wire up daily reminder notifications"
```

---

### Task 13: Apply Haptics Across App

**Files:**
- Modify: `components/camera/ShutterButton.tsx`
- Modify: `components/TabBar.tsx`
- Modify: Various components (replace raw `Haptics.*` calls with `haptics.*`)

- [ ] **Step 1: Update ShutterButton to use semantic haptic**

In `components/camera/ShutterButton.tsx`, replace any `Haptics.impactAsync(...)` on capture with:
```typescript
import { haptics } from '@/utils/haptics';
// ...
haptics.shutter();
```

- [ ] **Step 2: Update TabBar**

In `components/TabBar.tsx`, replace haptic calls with:
```typescript
import { haptics } from '@/utils/haptics';
// on tab press:
haptics.tap();
```

- [ ] **Step 3: Replace raw Haptics imports across existing components**

Search for `import * as Haptics from 'expo-haptics'` across the codebase. In each file:
- Replace `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` → `haptics.tap()`
- Replace `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` → `haptics.shutter()`
- Update imports to use `import { haptics } from '@/utils/haptics'` instead

Files that import `expo-haptics` directly (complete list):
- `app/album/[id].tsx`
- `app/(tabs)/albums.tsx`
- `app/(tabs)/timelapse.tsx`
- `components/profile/SettingsList.tsx`
- `components/profile/ProfileHeader.tsx`
- `components/timeline/PhotoModal.tsx` (already updated in Task 7)
- `components/timeline/MonthHeader.tsx`
- `components/timelapse/SpeedSelector.tsx`
- `components/timelapse/TimelapsePlayer.tsx`
- `components/timelapse/Scrubber.tsx`
- `components/camera/TimerSelector.tsx`
- `components/camera/ShutterButton.tsx` (updated in Step 1)
- `components/TabBar.tsx` (updated in Step 2)
- `components/ui/PillButton.tsx`
- `components/ui/CircleButton.tsx`

- [ ] **Step 4: Verify no TypeScript errors**

Run:
```bash
bunx tsc --noEmit --pretty
```

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat: apply consistent haptic feedback across all interactive components"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
bunx tsc --noEmit --pretty
```

Expected: Zero errors.

- [ ] **Step 2: Start the app and test all features**

```bash
bun run start
```

Test checklist:
1. Camera: mirror toggle (front only), retake confirmation with caption, quality setting works
2. Photo Modal: swipe between photos, pinch-to-zoom, double-tap zoom, edit caption, delete with file cleanup
3. Timelapse: date range selector, export to photo album, export backup (.rewind), cancel export
4. Timelapse: GIF and MP4 show "Coming Soon" alerts
5. Import: camera roll import with EXIF dates, .rewind backup import
6. Empty states: home (no photos), timelapse (< 2 photos), albums (no photos)
7. Notifications: toggle on/off, permission prompt
8. Haptics: consistent feel across ALL interactive components (15 files migrated)

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: address issues found during final verification"
```
