import { useMemo, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppContext } from '@/context/AppContext';
import { getGreeting, getDayNumber } from '@/utils/dates';

export function useGreeting() {
  const { profile } = useAppContext();

  // Bumped each time the app returns to the foreground so greeting + day number recompute
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setForegroundCount(c => c + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const greeting = useMemo(() => getGreeting(), [foregroundCount]);
  const dayNumber = useMemo(
    () => profile.joinDate ? getDayNumber(profile.joinDate) : 1,
    [profile.joinDate, foregroundCount]
  );

  return { greeting, dayNumber };
}
