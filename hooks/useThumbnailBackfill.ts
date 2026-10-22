import { useEffect, useRef } from 'react';
import { File } from 'expo-file-system';
import { useAppContext } from '@/context/AppContext';
import { makeThumbnail, needsThumbnail, thumbnailName } from '@/utils/photoEncode';
import type { PhotoEntry } from '@/types';

export const THUMB_FLUSH_EVERY = 20;

function deleteQuietly(uri: string | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

/**
 * Makes the small copies that calendar cells, filmstrip tiles and album rows show
 * (makeThumbnail), one photo at a time while `enabled`, saved in batches. It shows no
 * progress: until a photo has a thumbnail its tiles decode the full photo, as before.
 *
 * A thumbnail is kept only once its entry is saved: if the save fails or the photo is
 * deleted meanwhile, the file is removed, so none is ever left unreferenced.
 */
export function useThumbnailBackfill(photos: PhotoEntry[], enabled: boolean): void {
  const { updatePhotos } = useAppContext();
  const photosRef = useRef(photos);
  photosRef.current = photos;
  // Tried this session: successes until their entry arrives, failures so a bad file can't loop.
  const attemptedRef = useRef(new Set<string>());

  const hasWork = enabled && photos.some((p) => needsThumbnail(p) && !attemptedRef.current.has(p.id));

  useEffect(() => {
    if (!hasWork) return;
    let cancelled = false;
    let batch: Record<string, Partial<PhotoEntry>> = {};

    /** Saves the batch. False = the save failed (its files are removed); stop. */
    const flush = async (): Promise<boolean> => {
      const pending = batch;
      batch = {};
      const live = new Set(photosRef.current.map((p) => p.id));
      for (const id of Object.keys(pending)) {
        if (!live.has(id)) {
          deleteQuietly(pending[id].thumbUri);
          delete pending[id];
        }
      }
      if (Object.keys(pending).length === 0) return true;
      if (await updatePhotos(pending)) return true;
      Object.values(pending).forEach((patch) => deleteQuietly(patch.thumbUri));
      return false;
    };

    (async () => {
      try {
        while (!cancelled) {
          const next = photosRef.current.find((p) => needsThumbnail(p) && !attemptedRef.current.has(p.id));
          if (!next) break;
          attemptedRef.current.add(next.id);
          try {
            batch[next.id] = { thumbUri: await makeThumbnail(next.imageUri, thumbnailName(next.imageUri)) };
          } catch (e) {
            console.warn('[thumbnail] skipping photo for this session:', next.id, e);
            continue;
          }
          if (Object.keys(batch).length >= THUMB_FLUSH_EVERY && !(await flush())) break;
        }
      } finally {
        await flush();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasWork, updatePhotos]);
}
