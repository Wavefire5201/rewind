import { useCallback, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import type { PhotoEntry } from '@/types';

export function usePhotos(albumId?: string) {
  const { photos, today, addPhoto, updatePhoto, deletePhoto } = useAppContext();

  const filteredPhotos = useMemo(
    () => albumId ? photos.filter(p => p.albumId === albumId) : photos,
    [photos, albumId]
  );

  // AppContext keeps photos in date order, and filtering keeps it.
  const sortedPhotos = filteredPhotos;

  const todayPhoto = useMemo(
    () => filteredPhotos.find(p => p.date === today) ?? null,
    [filteredPhotos, today]
  );

  const mostRecentPhoto = useMemo(
    () => sortedPhotos.length > 0 ? sortedPhotos[sortedPhotos.length - 1] : null,
    [sortedPhotos]
  );

  const totalPhotos = filteredPhotos.length;

  const getPhotoByDate = (date: string): PhotoEntry | null =>
    filteredPhotos.find(p => p.date === date) ?? null;

  // One list per month, kept until the photos change: the album screen asks on every render,
  // and an unchanged list lets the calendar and photo viewer skip work.
  const monthCache = useMemo(() => new Map<string, PhotoEntry[]>(), [filteredPhotos]);
  const getPhotosByMonth = useCallback((year: number, month: number): PhotoEntry[] => {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    let list = monthCache.get(prefix);
    if (!list) {
      list = filteredPhotos.filter(p => p.date.startsWith(prefix));
      monthCache.set(prefix, list);
    }
    return list;
  }, [monthCache, filteredPhotos]);

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
