import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AndroidHaptics } from 'expo-haptics';

let lastAlignmentHaptic = 0;

/**
 * One Android system haptic: crisp, follows the phone's touch-feedback setting. Newer constants
 * (Confirm/Reject: API 30, Segment_*: API 34) reject on older phones, so fall back to one every
 * version has; a failed fallback is dropped (a missed haptic must never throw).
 */
function android(type: AndroidHaptics, fallback?: AndroidHaptics): void {
  Haptics.performAndroidHapticsAsync(type)
    .catch(() => (fallback ? Haptics.performAndroidHapticsAsync(fallback) : undefined))
    .catch(() => {});
}

const isAndroid = () => Platform.OS === 'android';

/**
 * The app's haptics by meaning. Each is one native haptic on each platform (never a buzz
 * pattern): Android system haptics, the Taptic Engine on iOS. Fire one per user action.
 */
export const haptics = {
  /** Button press, tab switch, opening a sheet */
  tap: () => {
    if (isAndroid()) android(AndroidHaptics.Context_Click);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** A small step: picking a day, changing month */
  tick: () => {
    if (isAndroid()) android(AndroidHaptics.Segment_Tick, AndroidHaptics.Clock_Tick);
    else Haptics.selectionAsync();
  },

  /** Photo capture */
  shutter: () => {
    if (isAndroid()) android(AndroidHaptics.Long_Press);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /** An action completed: photo saved, album deleted, export done */
  success: () => {
    if (isAndroid()) android(AndroidHaptics.Confirm, AndroidHaptics.Virtual_Key);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /** An action failed or was refused */
  error: () => {
    if (isAndroid()) android(AndroidHaptics.Reject, AndroidHaptics.Long_Press);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  /**
   * Graduated alignment feedback based on score (0-1).
   * - score < 0.3: lightest tick, debounced at 400ms
   * - score 0.3–0.7: a firmer tick, debounced at 200ms
   * - score > 0.7: continuous ticks
   */
  alignment: (score: number) => {
    const now = Date.now();
    if (score > 0.7) {
      if (isAndroid()) android(AndroidHaptics.Segment_Frequent_Tick, AndroidHaptics.Clock_Tick);
      else Haptics.selectionAsync();
      lastAlignmentHaptic = now;
    } else if (score >= 0.3) {
      if (now - lastAlignmentHaptic >= 200) {
        if (isAndroid()) android(AndroidHaptics.Segment_Tick, AndroidHaptics.Clock_Tick);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        lastAlignmentHaptic = now;
      }
    } else if (now - lastAlignmentHaptic >= 400) {
      if (isAndroid()) android(AndroidHaptics.Clock_Tick);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastAlignmentHaptic = now;
    }
  },
};
