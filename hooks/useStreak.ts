import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getWeekDays } from '@/utils/dates';
import { computeCurrentStreak, computeBestStreak, computeConsistency, computeDayStatus, trackingStartDate } from '@/utils/streak';
import type { DayStatus, WeekDay } from '@/types';

export function useStreak(albumId?: string, albumCreatedAt?: string) {
  const { photos, weights, profile, today } = useAppContext();

  const filteredPhotos = useMemo(
    () => albumId ? photos.filter(p => p.albumId === albumId) : photos,
    [photos, albumId]
  );

  const photoDates = useMemo(
    () => new Set(filteredPhotos.map(p => p.date)),
    [filteredPhotos]
  );

  // Weights count toward the start too (a weight logged for a day before the first photo).
  const weightDates = useMemo(
    () => weights.filter(w => !albumId || w.albumId === albumId).map(w => w.date),
    [weights, albumId],
  );

  const referenceDate = useMemo(
    () => trackingStartDate(albumCreatedAt, profile.joinDate, photoDates, weightDates),
    [albumCreatedAt, profile.joinDate, photoDates, weightDates],
  );

  const currentStreak = useMemo(() => {
    return computeCurrentStreak(photoDates, today, referenceDate);
  }, [photoDates, referenceDate, today]);

  const bestStreak = useMemo(() => {
    return computeBestStreak(filteredPhotos.map(p => p.date));
  }, [filteredPhotos]);

  const consistency = useMemo(() => {
    return computeConsistency(filteredPhotos.length, referenceDate);
  }, [filteredPhotos, referenceDate]);

  const weekStatus = useMemo((): WeekDay[] => {
    const weekDays = getWeekDays(today);
    return weekDays.map(wd => {
      const status: DayStatus = computeDayStatus(wd.date, today, referenceDate, photoDates);
      return { ...wd, status };
    });
  }, [photoDates, referenceDate, today]);

  return { currentStreak, bestStreak, consistency, weekStatus };
}
