import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getToday } from '@/utils/dates';
import type { PhotoEntry } from '@/types';

export function usePhotos() {
  const { photos, addPhoto, updatePhoto, deletePhoto } = useAppContext();

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => a.date.localeCompare(b.date)),
    [photos]
  );

  const todayPhoto = useMemo(
    () => photos.find(p => p.date === getToday()) ?? null,
    [photos]
  );

  const mostRecentPhoto = useMemo(
    () => sortedPhotos.length > 0 ? sortedPhotos[sortedPhotos.length - 1] : null,
    [sortedPhotos]
  );

  const totalPhotos = photos.length;

  const getPhotoByDate = (date: string): PhotoEntry | null =>
    photos.find(p => p.date === date) ?? null;

  const getPhotosByMonth = (year: number, month: number): PhotoEntry[] =>
    photos.filter(p => {
      const [y, m] = p.date.split('-').map(Number);
      return y === year && m === month;
    });

  return {
    photos: sortedPhotos,
    todayPhoto,
    mostRecentPhoto,
    totalPhotos,
    getPhotoByDate,
    getPhotosByMonth,
    addPhoto,
    updatePhoto,
    deletePhoto,
  };
}
