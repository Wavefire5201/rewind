import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getGreeting, getDayNumber } from '@/utils/dates';

export function useGreeting() {
  const { profile } = useAppContext();

  const greeting = useMemo(() => getGreeting(), []);
  const dayNumber = useMemo(
    () => profile.joinDate ? getDayNumber(profile.joinDate) : 1,
    [profile.joinDate]
  );

  return { greeting, dayNumber };
}
