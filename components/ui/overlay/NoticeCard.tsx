import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInUp, FadeOut, FadeOutUp, LinearTransition, ReduceMotion,
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CheckCircle, Info, WarningCircle } from 'phosphor-react-native';
import { Colors, Fonts, Pressed } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import { NOTICE_DURATION_MS, type Notice, type NoticeTone } from '@/utils/notify';

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);
/** A swipe past this distance or speed dismisses the notice; less springs it back. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 600;

const EDGE: Record<NoticeTone, string> = { success: Colors.accent, error: Colors.danger, info: Colors.borderPrimary };
const ICON: Record<NoticeTone, typeof CheckCircle> = { success: CheckCircle, error: WarningCircle, info: Info };

// Slides down from about its own height above, leaves the way it came. Reduce Motion: fades only.
const ENTER = FadeInUp.duration(380).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: -72 }] });
const EXIT = FadeOutUp.duration(220).easing(EASE_IN);
const ENTER_REDUCED = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
const EXIT_REDUCED = FadeOut.duration(150).reduceMotion(ReduceMotion.Never);
const RESTACK = LinearTransition.duration(220).easing(EASE_OUT);

export default function NoticeCard({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const { fonts } = useFont();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const timeLeft = useSharedValue(1);
  const Icon = ICON[notice.tone];
  // A stable function for the gesture worklet: the gesture is built once, not on every render.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const dismiss = useCallback(() => onDismissRef.current(), []);

  useEffect(() => {
    if (notice.sticky) return;
    timeLeft.value = withTiming(0, { duration: NOTICE_DURATION_MS[notice.tone], easing: Easing.linear });
  }, [notice.sticky, notice.tone, timeLeft]);

  const pan = useMemo(() => Gesture.Pan()
    // Moves only after a real drag, so a tap still reaches the action button.
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      dragX.value = e.translationX;
      // Up only: a notice can't be pulled down into the screen.
      dragY.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      const sideways = Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY;
      const upward = e.translationY < -SWIPE_DISTANCE || e.velocityY < -SWIPE_VELOCITY;
      const done = (finished?: boolean) => { if (finished) runOnJS(dismiss)(); };
      if (sideways) {
        const direction = (e.translationX || e.velocityX) < 0 ? -1 : 1;
        dragX.value = withTiming(direction * width, { duration: 240, easing: EASE_IN }, done);
      } else if (upward) {
        dragY.value = withTiming(-160, { duration: 240, easing: EASE_IN }, done);
      } else {
        dragX.value = withTiming(0, { duration: 220, easing: EASE_OUT });
        dragY.value = withTiming(0, { duration: 220, easing: EASE_OUT });
      }
    }), [dragX, dragY, dismiss, width]);

  const dragStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(dragX.value) / width),
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));
  const countdownStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: timeLeft.value }] }));

  function handleAction() {
    haptics.tap();
    notice.action?.onPress();
    dismiss();
  }

  return (
    <Animated.View
      testID="notice-card"
      entering={reduceMotion ? ENTER_REDUCED : ENTER}
      exiting={reduceMotion ? EXIT_REDUCED : EXIT}
      layout={RESTACK}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.card, { borderLeftColor: EDGE[notice.tone] }, dragStyle]}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={notice.message ? `${notice.title}. ${notice.message}` : notice.title}
          accessibilityActions={[{ name: 'escape', label: 'dismiss' }]}
          onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'escape') dismiss(); }}
        >
          <Icon size={16} color={notice.tone === 'info' ? Colors.textSecondary : EDGE[notice.tone]} weight="light" />
          <View style={styles.text}>
            <Text style={[styles.title, { fontFamily: fonts.medium }]}>{notice.title}</Text>
            {notice.message ? <Text style={[styles.message, { fontFamily: fonts.regular }]}>{notice.message}</Text> : null}
          </View>
          {notice.action ? (
            <Pressable
              onPress={handleAction}
              hitSlop={10}
              style={({ pressed }) => [styles.action, pressed && { opacity: Pressed.text }]}
              accessibilityRole="button"
              accessibilityLabel={notice.action.label}
            >
              <Text style={[styles.actionText, { fontFamily: fonts.medium }]}>{notice.action.label}</Text>
            </Pressable>
          ) : null}
          {notice.sticky ? null : (
            <Animated.View testID="notice-countdown" style={[styles.countdown, { backgroundColor: EDGE[notice.tone] }, countdownStyle]} />
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: Fonts.mono.medium,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textPrimary,
  },
  message: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  action: {
    alignSelf: 'center',
    paddingLeft: 4,
  },
  actionText: {
    fontFamily: Fonts.mono.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.accent,
  },
  countdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    // Shrinks toward the left edge as time runs out. Array form: RN parses the string form as integer px only.
    transformOrigin: [0, 0, 0],
  },
});
