import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getToday } from '@/utils/dates';
import type { PhotoEntry } from '@/types';

export function usePhotos(albumId?: string) {
  const { photos, addPhoto, updatePhoto, deletePhoto } = useAppContext();

  const filteredPhotos = useMemo(
    () => albumId ? photos.filter(p => p.albumId === albumId) : photos,
    [photos, albumId]
  );

  const sortedPhotos = useMemo(
    () => [...filteredPhotos].sort((a, b) => a.date.localeCompare(b.date)),
    [filteredPhotos]
  );

  const todayPhoto = useMemo(
    () => filteredPhotos.find(p => p.date === getToday()) ?? null,
    [filteredPhotos]
  );

  const mostRecentPhoto = useMemo(
    () => sortedPhotos.length > 0 ? sortedPhotos[sortedPhotos.length - 1] : null,
    [sortedPhotos]
  );

  const totalPhotos = filteredPhotos.length;

  const getPhotoByDate = (date: string): PhotoEntry | null =>
    filteredPhotos.find(p => p.date === date) ?? null;

  const getPhotosByMonth = (year: number, month: number): PhotoEntry[] =>
    filteredPhotos.filter(p => {
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
