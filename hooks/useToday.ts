import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getToday } from '@/utils/dates';

/**
 * Today's local date (YYYY-MM-DD), kept current: it changes at local midnight while the
 * app is open, and is re-read whenever the app comes back to the foreground (timers may
 * not run in the background). Memos that depend on "today" must list it as a dependency.
 */
export function useToday(): string {
  const [today, setToday] = useState(getToday);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => setToday(getToday());
    const scheduleMidnight = () => {
      clearTimeout(timer);
      const now = new Date();
      // One second past midnight, so the new day has certainly started.
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh();
      scheduleMidnight();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return today;
}
