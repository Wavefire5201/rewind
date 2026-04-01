import * as Haptics from 'expo-haptics';

let lastAlignmentHaptic = 0;

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

  /**
   * Graduated alignment feedback based on score (0-1).
   * - score < 0.3: light impact, debounced at 400ms
   * - score 0.3–0.7: medium impact, debounced at 200ms
   * - score > 0.7: continuous selection feedback
   */
  alignment: (score: number) => {
    const now = Date.now();
    if (score > 0.7) {
      // Continuous selection feedback — no debounce needed
      Haptics.selectionAsync();
      lastAlignmentHaptic = now;
    } else if (score >= 0.3) {
      const debounce = 200;
      if (now - lastAlignmentHaptic >= debounce) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        lastAlignmentHaptic = now;
      }
    } else {
      const debounce = 400;
      if (now - lastAlignmentHaptic >= debounce) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        lastAlignmentHaptic = now;
      }
    }
  },
};
