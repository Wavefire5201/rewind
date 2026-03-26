import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getToday, getWeekDays, getDayNumber } from '@/utils/dates';
import type { DayStatus, WeekDay } from '@/types';

export function useStreak(albumId?: string, albumCreatedAt?: string) {
  const { photos, profile } = useAppContext();

  const filteredPhotos = useMemo(
    () => albumId ? photos.filter(p => p.albumId === albumId) : photos,
    [photos, albumId]
  );

  const photoDates = useMemo(
    () => new Set(filteredPhotos.map(p => p.date)),
    [filteredPhotos]
  );

  const currentStreak = useMemo(() => {
    const today = getToday();
    let streak = 0;
    const d = new Date();

    // Check if today has a photo, if not start from yesterday
    if (!photoDates.has(today)) {
      d.setDate(d.getDate() - 1);
    }

    while (true) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (photoDates.has(dateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }, [photoDates]);

  const bestStreak = useMemo(() => {
    if (filteredPhotos.length === 0) return 0;
    const sorted = [...filteredPhotos].sort((a, b) => a.date.localeCompare(b.date));
    let best = 1;
    let current = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date + 'T00:00:00');
      const curr = new Date(sorted[i].date + 'T00:00:00');
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 1;
      }
    }

    return best;
  }, [filteredPhotos]);

  const referenceDate = albumCreatedAt ?? profile.joinDate;

  const consistency = useMemo(() => {
    if (!referenceDate || filteredPhotos.length === 0) return 0;
    const daysSinceStart = getDayNumber(referenceDate);
    if (daysSinceStart <= 0) return 100; // First day — 100% if any photo exists
    return Math.min(100, Math.round((filteredPhotos.length / daysSinceStart) * 100));
  }, [filteredPhotos, referenceDate]);

  const weekStatus = useMemo((): WeekDay[] => {
    const today = getToday();
    const weekDays = getWeekDays(today);
    // Use albumCreatedAt for disabled check if provided
    const startDate = albumCreatedAt ?? profile.joinDate;

    return weekDays.map(wd => {
      let status: DayStatus;
      if (startDate && wd.date < startDate) {
        status = 'disabled';
      } else if (wd.date > today) {
        status = 'upcoming';
      } else if (wd.date === today) {
        status = photoDates.has(today) ? 'today-done' : 'today-pending';
      } else {
        status = photoDates.has(wd.date) ? 'captured' : 'missed';
      }
      return { ...wd, status };
    });
  }, [photoDates, profile.joinDate, albumCreatedAt]);

  return { currentStreak, bestStreak, consistency, weekStatus };
}
