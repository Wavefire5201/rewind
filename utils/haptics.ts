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
