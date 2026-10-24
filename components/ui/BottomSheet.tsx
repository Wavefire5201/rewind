import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedKeyboard, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NoticeLayer from '@/components/ui/overlay/NoticeLayer';
import { markSheetOpen } from '@/components/ui/overlay/layers';
import { Colors } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

export interface BottomSheetProps {
  visible: boolean;
  /** Scrim tap, a drag down past the threshold, or Android back. */
  onClose: () => void;
  /** Default true; false ignores all three (e.g. while an export runs). */
  dismissible?: boolean;
  /** After the exit animation, when the sheet has left the screen. */
  onClosed?: () => void;
  /** Drag only from the handle at the top, for sheets whose content scrolls vertically. */
  dragFromHandleOnly?: boolean;
  /**
   * Render in the screen instead of a Modal. A Modal is its own Android window and the keyboard
   * never reports to it, so a sheet with a text field must be inline for KeyboardAvoidingView to
   * work. Place it as the last child of the screen's root view; notices show from the app root.
   */
  inline?: boolean;
  children: React.ReactNode;
  testID?: string;
}

const OPEN = { duration: 340, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const CLOSE = { duration: 220, easing: Easing.bezier(0.4, 0, 1, 1) };
const SCRIM_MS = 200;
/** A drag down past this share of the sheet's height, or this fast, closes it. */
const CLOSE_DRAG_SHARE = 0.3;
const CLOSE_DRAG_VELOCITY = 800;

/**
 * The app's one bottom sheet: slides up, drags down to close, scrim tap and Android back
 * close it. With Reduce Motion on it fades instead of sliding. Notices raised while it's open
 * show above it.
 */
export default function BottomSheet({ visible, onClose, dismissible = true, onClosed, dragFromHandleOnly = false, inline = false, children, testID }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // The Modal stays up while the sheet animates out.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(0);
  const scrim = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Until measured, assume a full screen so the first frame starts off-screen.
  const sheetHeight = useSharedValue(windowHeight);

  const latest = useRef({ onClose, onClosed, dismissible });
  latest.current = { onClose, onClosed, dismissible };

  const requestClose = useCallback(() => {
    if (latest.current.dismissible) latest.current.onClose();
  }, []);

  const finishClose = useCallback(() => {
    setMounted(false);
    latest.current.onClosed?.();
  }, []);

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      progress.value = withTiming(1, OPEN);
      scrim.value = withTiming(1, { duration: SCRIM_MS });
    } else {
      progress.value = withTiming(0, CLOSE, (finished) => { if (finished) runOnJS(finishClose)(); });
      scrim.value = withTiming(0, { duration: SCRIM_MS });
    }
  }, [visible, progress, scrim, dragY, finishClose]);

  // A confirm waits until no sheet is on screen (iOS can't present two sibling Modals).
  useEffect(() => (mounted ? markSheetOpen() : undefined), [mounted]);

  // Inline there's no Modal to take Android back: take it while the sheet is up.
  useEffect(() => {
    if (!inline || !mounted) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [inline, mounted, requestClose]);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY(10)
    // Sideways swipes belong to the content (e.g. the calendar's months).
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > sheetHeight.value * CLOSE_DRAG_SHARE || e.velocityY > CLOSE_DRAG_VELOCITY) {
        runOnJS(requestClose)();
      } else {
        dragY.value = withTiming(0, OPEN);
      }
    }), [dragY, sheetHeight, requestClose]);

  const sheetStyle = useAnimatedStyle(() => (reduceMotion
    ? { opacity: progress.value, transform: [{ translateY: dragY.value }] }
    : { transform: [{ translateY: (1 - progress.value) * sheetHeight.value + dragY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const handle = (
    <View testID="sheet-handle" style={styles.handle}>
      <View style={styles.grabBar} />
    </View>
  );
  const sheet = (
    <Animated.View
      testID="bottom-sheet"
      accessibilityViewIsModal
      onLayout={(e) => { sheetHeight.value = e.nativeEvent.layout.height; }}
      style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}
    >
      {dragFromHandleOnly ? <GestureDetector gesture={pan}>{handle}</GestureDetector> : handle}
      <View testID={testID}>{children}</View>
      {inline && <KeyboardSpacer bottomInset={insets.bottom} />}
    </Animated.View>
  );

  function handleScrimPress() {
    if (!dismissible) return;
    haptics.tap();
    requestClose();
  }

  const layers = (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleScrimPress} testID="sheet-backdrop" accessible={false} />
      </Animated.View>
      {dragFromHandleOnly ? sheet : <GestureDetector gesture={pan}>{sheet}</GestureDetector>}
    </>
  );

  if (inline) {
    return mounted ? <View style={[StyleSheet.absoluteFill, styles.root, styles.inline]}>{layers}</View> : null;
  }

  return (
    <Modal
      testID="bottom-sheet-modal"
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {layers}
        <NoticeLayer />
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Grows with the keyboard, frame by frame, so an inline sheet's content stays above it. Less the
 * bottom inset, which the sheet's padding already covers.
 */
function KeyboardSpacer({ bottomInset }: { bottomInset: number }) {
  const keyboard = useAnimatedKeyboard();
  const style = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.height.value - bottomInset) }));
  return <Animated.View testID="keyboard-spacer" style={style} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Above the rest of the screen, including anything with elevation on Android.
  inline: {
    zIndex: 100,
    elevation: 100,
  },
  scrim: {
    backgroundColor: Colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 20,
  },
  // Full width across the top, so it's easy to grab.
  handle: {
    alignItems: 'center',
    marginHorizontal: -20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  grabBar: {
    width: 34,
    height: 3,
    backgroundColor: Colors.borderPrimary,
  },
});
