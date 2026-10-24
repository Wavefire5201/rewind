import React, { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NoticeCard from '@/components/ui/overlay/NoticeCard';
import { useTopLayer } from '@/components/ui/overlay/layers';
import { dismissNotice, getNotices, setScreenReaderEnabled, subscribeNotices } from '@/utils/notify';

/**
 * Shows the notices, stacked under the status bar, when this is the topmost notice layer. Mount
 * one at the app root and one inside every Modal; only the top one draws.
 */
export default function NoticeLayer({ testID }: { testID?: string }) {
  const isTop = useTopLayer('notice');
  const notices = useSyncExternalStore(subscribeNotices, getNotices);
  const insets = useSafeAreaInsets();

  // With a screen reader on, notices stay until dismissed, so there's time to reach them.
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (mounted) setScreenReaderEnabled(on); }, () => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Its own gesture root: inside a Modal's window there's none above it, so swipes need one here
  // (nested in the app's root view, it's a plain view).
  return (
    <GestureHandlerRootView testID={testID} style={[styles.layer, { top: insets.top + 8 }]} pointerEvents="box-none">
      {isTop && notices.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} onDismiss={() => dismissNotice(notice.id)} />
      ))}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
  },
});
