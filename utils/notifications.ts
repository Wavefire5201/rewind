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

async function getNotifications() {
  const Notifications = await import('expo-notifications');
  return Notifications;
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = await getNotifications();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    // expo-notifications not available (e.g. Expo Go on SDK 53+)
    return false;
  }
}

export async function scheduleDailyReminder(timeStr: string): Promise<void> {
  try {
    const Notifications = await getNotifications();
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
  } catch {
    // expo-notifications not available
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // expo-notifications not available
  }
}

export async function setupNotificationHandler(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // expo-notifications not available
  }
}
