import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, AppState } from 'react-native';
import { File } from 'expo-file-system';
import type { PhotoEntry, UserProfile, AppSettings, Album } from '@/types';
import { savePhotos, loadPhotos, saveProfile, loadProfile, saveSettings, loadSettings, getDefaultSettings, saveAlbums, loadAlbums, clearAllData, clearUnlockedAlbumIds } from '@/utils/storage';
import { USE_MOCK_DATA, MOCK_PHOTOS, MOCK_PROFILE, MOCK_SETTINGS } from '@/constants/mockData';
import { cancelAlbumReminder, cancelAllReminders } from '@/utils/notifications';
import { haptics } from '@/utils/haptics';
import { useToday } from '@/hooks/useToday';
import { getToday, byDate } from '@/utils/dates';

function fireAndSave(saveFn: () => Promise<void>): Promise<boolean> {
  return enqueueSave(saveFn);
}

let saveQueue = Promise.resolve();

// Serial so writes can't race; the catch keeps the queue alive after a failure and
// surfaces it (log + haptic) instead of leaving an unhandled rejection. Resolves with
// whether this write reached storage.
function enqueueSave(saveFn: () => Promise<void>): Promise<boolean> {
  const done = saveQueue.then(saveFn).then(
    () => true,
    (e) => {
      console.error('Storage write failed:', e);
      haptics.error();
      return false;
    },
  );
  saveQueue = done.then(() => undefined);
  return done;
}

// Photo saves are latest-wins. Each one writes the whole array (about 1 MB at 1000 photos),
// and the states in between are never read back, so while a write is in flight newer states
// replace each other and only the newest is written next: a burst of N changes costs one or
// two writes, not N. Each caller still hears whether a write including its change landed.
let pendingPhotos: { photos: PhotoEntry[]; waiters: ((saved: boolean) => void)[] } | null = null;
let writingPhotos = false;

// Set when the stored photos couldn't be read at launch. The app then holds none of them, and
// a photo save writes the whole array, so any save would replace them all: every photo save
// is refused until the next launch reads them (or a reset clears them).
let photoSavesBlocked = false;

function savePhotosLatest(photos: PhotoEntry[]): Promise<boolean> {
  if (photoSavesBlocked) {
    console.error('Photos not saved: the stored photos could not be read, and saving would replace them.');
    haptics.error();
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    if (pendingPhotos) {
      pendingPhotos.photos = photos;
      pendingPhotos.waiters.push(resolve);
    } else {
      pendingPhotos = { photos, waiters: [resolve] };
    }
    if (!writingPhotos) void writePendingPhotos();
  });
}

async function writePendingPhotos() {
  writingPhotos = true;
  while (pendingPhotos) {
    const { photos, waiters } = pendingPhotos;
    pendingPhotos = null;
    const saved = await enqueueSave(() => savePhotos(photos));
    waiters.forEach((resolve) => resolve(saved));
  }
  writingPhotos = false;
}

const DEFAULT_ALBUMS: Album[] = [];

const photoKey = (p: PhotoEntry) => `${p.albumId}:${p.date}`;

// A photo's files on disk: the photo itself and its thumbnail.
const filesOf = (p: PhotoEntry) => [p.imageUri, p.thumbUri];

// Deletes the files of `removed` entries that no entry in `photos` still points at. Only call
// it after the save that dropped them succeeded: a failed save keeps the entries, which
// still need them.
function deleteUnreferencedFiles(removed: PhotoEntry[], photos: PhotoEntry[]) {
  const inUse = new Set(photos.flatMap(filesOf));
  for (const uri of new Set(removed.flatMap(filesOf))) {
    if (!uri?.startsWith('file://') || inUse.has(uri)) continue;
    try { new File(uri).delete(); } catch {}
  }
}

// Unlocked albums lock again once the app has been in the background this long. Long
// enough to survive a photo picker or share sheet, short enough that a phone picked up
// later doesn't open them.
export const RELOCK_AFTER_MS = 60_000;

interface AppContextValue {
  photos: PhotoEntry[];
  profile: UserProfile;
  settings: AppSettings;
  albums: Album[];
  /** Today's local date, updated at midnight and on returning to the foreground. */
  today: string;
  isLoading: boolean;
  /**
   * The stored photos couldn't be read this launch. They're still stored, so nothing saves
   * photos over them: adding photos is refused (see useCanAddPhotos) until the next launch.
   */
  photosLoadFailed: boolean;
  addPhoto: (entry: PhotoEntry) => void;
  addPhotos: (entries: PhotoEntry[]) => { added: number; skipped: number };
  updatePhoto: (id: string, updates: Partial<PhotoEntry>) => void;
  /** Resolves with whether the patch reached storage (e.g. before deleting a replaced file). */
  updatePhotos: (patches: Record<string, Partial<PhotoEntry>>) => Promise<boolean>;
  deletePhoto: (id: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addAlbum: (album: Album) => void;
  updateAlbum: (id: string, updates: Partial<Album>) => void;
  deleteAlbum: (id: string) => void;
  resetAllData: () => Promise<void>;
  seedMockPhotos: (albumId?: string) => void;
  unlockedAlbumIds: Set<string>;
  unlockAlbum: (id: string) => void;
}

// A function, not a constant: the join date is today's local date when the profile starts.
const newProfile = (): UserProfile => ({ name: 'You', avatarUri: null, joinDate: getToday() });

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile>(newProfile);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [albums, setAlbums] = useState<Album[]>(DEFAULT_ALBUMS);
  const [isLoading, setIsLoading] = useState(true);
  const [photosLoadFailed, setPhotosLoadFailed] = useState(false);
  const [unlockedAlbumIds, setUnlockedAlbumIds] = useState<Set<string>>(new Set());
  const today = useToday();

  // Synchronous mirror of `photos` for event handlers that must compute against
  // current state (e.g. addPhotos dedup counts). setState updaters run
  // asynchronously, so counting inside an updater makes the returned counts
  // depend on React's eager-evaluation timing — this ref is always fresh.
  const photosRef = useRef<PhotoEntry[]>([]);
  photosRef.current = photos;

  // Unlocks are memory-only: a restart, or a while in the background, locks albums again.
  const unlockAlbum = useCallback((id: string) => {
    setUnlockedAlbumIds(prev => new Set(prev).add(id));
  }, []);

  const forgetUnlock = useCallback((id: string) => {
    setUnlockedAlbumIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
      } else if (state === 'active') {
        if (backgroundedAt !== null && Date.now() - backgroundedAt > RELOCK_AFTER_MS) {
          setUnlockedAlbumIds(prev => (prev.size === 0 ? prev : new Set()));
        }
        backgroundedAt = null;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    async function init() {
      try {
          const [photosResult, profileResult, settingsResult, albumsResult] = await Promise.allSettled([
            loadPhotos(),
            loadProfile(),
            loadSettings(),
            loadAlbums(),
            clearUnlockedAlbumIds(),
          ]);
        // A failed read is not "no photos": they're still stored, and the first save would
        // replace them all. Refuse photo saves for this launch and say so.
        photoSavesBlocked = photosResult.status === 'rejected';
        if (photosResult.status === 'rejected') {
          console.error('Failed to load photos; not saving photos this launch:', photosResult.reason);
          setPhotosLoadFailed(true);
          haptics.error();
          Alert.alert(
            "Couldn't load your photos",
            "Nothing has been deleted, but Rewind couldn't read your saved photos. To keep them safe, new photos can't be saved for now. Try restarting the app.",
          );
        }
        const storedPhotos = photosResult.status === 'fulfilled' ? photosResult.value : [];
        const storedProfile = profileResult.status === 'fulfilled' ? profileResult.value : null;
        const storedSettings = settingsResult.status === 'fulfilled' ? settingsResult.value : getDefaultSettings();
        const storedAlbums = albumsResult.status === 'fulfilled' ? albumsResult.value : null;

        if (storedPhotos.length > 0) {
          // Migrate legacy photos missing albumId
          const needsMigration = storedPhotos.some(p => !p.albumId);
          const migratedPhotos = needsMigration
            ? storedPhotos.map(p => p.albumId ? p : { ...p, albumId: 'daily-selfie' })
            : storedPhotos;
          // Kept in date order from here on (every add sorts), so hooks never re-sort.
          setPhotos([...migratedPhotos].sort(byDate));
          if (needsMigration) {
            // The photos are in state first, so a failed write here can't leave the app empty
            // over stored photos; the next photo save writes the migration.
            await savePhotos(migratedPhotos).catch((e) => console.error('Photo migration not saved:', e));
          }
          // Derive joinDate from earliest photo if no stored profile
          const fallbackProfile: UserProfile = storedProfile ?? {
            ...newProfile(),
            joinDate: [...storedPhotos].sort(byDate)[0]?.date ?? getToday(),
          };
          if (!storedProfile) await saveProfile(fallbackProfile);
          setProfile(fallbackProfile);
          setSettings(storedSettings);
        } else if (USE_MOCK_DATA && !photoSavesBlocked) {
          // Seed with mock data on first launch
          setPhotos(MOCK_PHOTOS);
          setProfile(MOCK_PROFILE);
          setSettings(MOCK_SETTINGS);
          await Promise.all([
            savePhotos(MOCK_PHOTOS),
            saveProfile(MOCK_PROFILE),
            saveSettings(MOCK_SETTINGS),
          ]);
        }

        if (storedAlbums && storedAlbums.length > 0) {
          // Migrate legacy albums missing reminder fields (stored data may lack new fields)
          const raw = storedAlbums as (Album & Record<string, unknown>)[];
          const needsAlbumMigration = raw.some(a => a.reminderEnabled === undefined);
          const migratedAlbums: Album[] = raw.map(a => ({
            id: a.id,
            name: a.name,
            createdAt: a.createdAt,
            reminderEnabled: a.reminderEnabled ?? false,
            reminderTime: a.reminderTime ?? '08:00',
            isLocked: a.isLocked ?? false,
          }));
          if (needsAlbumMigration) {
            await saveAlbums(migratedAlbums);
          }
          setAlbums(migratedAlbums);
        } else if (USE_MOCK_DATA) {
          // Seed default album for mock data mode
          const earliestDate = [...MOCK_PHOTOS].sort(byDate)[0]?.date;
          const mockAlbum: Album = {
            id: 'daily-selfie',
            name: 'daily selfie',
            createdAt: earliestDate ? new Date(earliestDate).toISOString() : new Date().toISOString(),
            reminderEnabled: false,
            reminderTime: '08:00',
            isLocked: false,
          };
          setAlbums([mockAlbum]);
          await saveAlbums([mockAlbum]);
        }
      } catch (e) {
        console.error('Failed to load app data:', e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Applies one change to the photos and saves it. Resolves with whether the save reached
  // storage; files an update removes are deleted only after that (see deleteUnreferencedFiles).
  const commitPhotos = useCallback((change: (prev: PhotoEntry[]) => PhotoEntry[]): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPhotos(prev => {
        const next = change(prev);
        if (next === prev) {
          resolve(true);
          return prev;
        }
        // An updater can run twice (StrictMode); the first save to settle answers.
        savePhotosLatest(next).then(resolve);
        // A change that can't be saved isn't shown either: it would be gone on the next launch.
        return photoSavesBlocked ? prev : next;
      });
    });
  }, []);

  const addPhoto = useCallback((entry: PhotoEntry) => {
    // Replaces any photo already on that day; its file goes once the replacement is saved.
    let replaced: PhotoEntry[] = [];
    commitPhotos(prev => {
      replaced = prev.filter(p => photoKey(p) === photoKey(entry));
      const kept = prev.filter(p => photoKey(p) !== photoKey(entry));
      return [...kept, entry].sort(byDate);
    }).then(saved => {
      if (saved) deleteUnreferencedFiles(replaced, photosRef.current);
    });
  }, [commitPhotos]);

  /**
   * Adds photos, skipping any whose album and day already have one. The entries' files
   * (fresh copies from an import) belong to the store from here on: a skipped entry's file
   * is deleted, unless an existing photo uses it.
   */
  const addPhotos = useCallback((entries: PhotoEntry[]): { added: number; skipped: number } => {
    // Dedup synchronously against the ref mirror so counts are deterministic.
    // The updater re-checks against prev as a guard for batched calls.
    const seen = new Set(photosRef.current.map(photoKey));
    const toAdd: PhotoEntry[] = [];
    const skipped: PhotoEntry[] = [];
    for (const entry of entries) {
      if (seen.has(photoKey(entry))) {
        skipped.push(entry);
      } else {
        seen.add(photoKey(entry));
        toAdd.push(entry);
      }
    }
    deleteUnreferencedFiles(skipped, [...photosRef.current, ...toAdd]);
    if (toAdd.length > 0) {
      let dropped: PhotoEntry[] = [];
      commitPhotos(prev => {
        const prevKeys = new Set(prev.map(photoKey));
        dropped = toAdd.filter(e => prevKeys.has(photoKey(e)));
        const fresh = toAdd.filter(e => !prevKeys.has(photoKey(e)));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh].sort(byDate);
      }).then(() => deleteUnreferencedFiles(dropped, photosRef.current));
    }
    return { added: toAdd.length, skipped: skipped.length };
  }, [commitPhotos]);

  const updatePhoto = useCallback((id: string, updates: Partial<PhotoEntry>) => {
    commitPhotos(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  }, [commitPhotos]);

  // Batched variant of updatePhoto: one state update + one save for many photos.
  // updatePhoto rewrites the whole array per call, so a 240-photo face-scan backfill
  // through it would mean 240 full writes. Ids not present (e.g. a photo deleted
  // mid-scan) are ignored.
  const updatePhotos = useCallback((patches: Record<string, Partial<PhotoEntry>>): Promise<boolean> => {
    if (Object.keys(patches).length === 0) return Promise.resolve(true);
    return commitPhotos(prev =>
      prev.map(p => (Object.prototype.hasOwnProperty.call(patches, p.id) ? { ...p, ...patches[p.id] } : p)),
    );
  }, [commitPhotos]);

  const deletePhoto = useCallback((id: string) => {
    let removed: PhotoEntry[] = [];
    commitPhotos(prev => {
      removed = prev.filter(p => p.id === id);
      return removed.length > 0 ? prev.filter(p => p.id !== id) : prev;
    }).then(saved => {
      if (saved) deleteUnreferencedFiles(removed, photosRef.current);
    });
  }, [commitPhotos]);

  const handleUpdateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      fireAndSave(() => saveProfile(next));
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      fireAndSave(() => saveSettings(next));
      return next;
    });
  }, []);

  const addAlbum = useCallback((album: Album) => {
    setAlbums(prev => {
      const next = [...prev, album];
      fireAndSave(() => saveAlbums(next));
      return next;
    });
  }, []);

  const updateAlbum = useCallback((id: string, updates: Partial<Album>) => {
    setAlbums(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      fireAndSave(() => saveAlbums(next));
      return next;
    });
    // Locking an album again must take effect, not ride on an earlier unlock.
    if (updates.isLocked === true) forgetUnlock(id);
  }, [forgetUnlock]);

  const deleteAlbum = useCallback((id: string) => {
    if (albums.length <= 1) return;
    setAlbums(prev => {
      const next = prev.filter(a => a.id !== id);
      fireAndSave(() => saveAlbums(next));
      return next;
    });
    cancelAlbumReminder(id);
    forgetUnlock(id);
    let removed: PhotoEntry[] = [];
    commitPhotos(prev => {
      removed = prev.filter(p => p.albumId === id);
      return removed.length > 0 ? prev.filter(p => p.albumId !== id) : prev;
    }).then(saved => {
      if (saved) deleteUnreferencedFiles(removed, photosRef.current);
    });
  }, [albums.length, forgetUnlock, commitPhotos]);

  const resetAllData = useCallback(async () => {
    const localUris = photosRef.current.flatMap(filesOf).filter((uri): uri is string => !!uri?.startsWith('file://'));
    await clearAllData();
    // Nothing is stored now, unreadable photos included, so photos can be saved again.
    photoSavesBlocked = false;
    setPhotosLoadFailed(false);
    for (const uri of localUris) {
      try { new File(uri).delete(); } catch {}
    }
    // The albums are gone, so are their reminders.
    await cancelAllReminders();
    setPhotos([]);
    setProfile(newProfile());
    setSettings(getDefaultSettings());
    setAlbums([]);
    setUnlockedAlbumIds(new Set());
  }, []);

  const seedMockPhotos = useCallback((albumId?: string) => {
    // Generate 7 mock photos: today back through last 6 days
    const mockPhotos: PhotoEntry[] = [];
    const MOCK_IMAGES = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=533&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=533&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=533&fit=crop',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=533&fit=crop',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=533&fit=crop',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=533&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=533&fit=crop',
    ];
    const CAPTIONS = ['Morning light', 'Coffee time', 'Golden hour', 'Rainy day', 'Sunday calm', 'Feeling good', 'Post-workout'];

    // albumId passed as parameter to avoid stale closure over albums state
    const resolvedAlbumId = albumId ?? 'daily-selfie';
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const capturedAt = new Date(d);
      capturedAt.setHours(8, i * 7, 0, 0);
      mockPhotos.push({
        id: `mock-${Date.now()}-${i}`,
        albumId: resolvedAlbumId,
        date: dateStr,
        imageUri: MOCK_IMAGES[i],
        caption: CAPTIONS[i],
        capturedAt: capturedAt.toISOString(),
        cameraDirection: 'front',
      });
    }

    setPhotos(prev => {
      // Don't overwrite existing photos for same date+album
      const existingDates = new Set(prev.map(p => `${p.date}:${p.albumId}`));
      const newPhotos = mockPhotos.filter(p => !existingDates.has(`${p.date}:${p.albumId}`));
      const next = [...prev, ...newPhotos].sort(byDate);
      savePhotosLatest(next);
      return next;
    });

    const earliest = mockPhotos[mockPhotos.length - 1].date;
    setProfile(prev => {
      if (!prev.joinDate || earliest < prev.joinDate) {
        const next = { ...prev, joinDate: earliest };
        fireAndSave(() => saveProfile(next));
        return next;
      }
      return prev;
    });

    setAlbums(prev => {
      const earliestISO = new Date(earliest + 'T00:00:00').toISOString();
      const updated = prev.map(a => {
        if (a.id === resolvedAlbumId && a.createdAt > earliestISO) {
          return { ...a, createdAt: earliestISO };
        }
        return a;
      });
      if (JSON.stringify(updated) !== JSON.stringify(prev)) {
        fireAndSave(() => saveAlbums(updated));
        return updated;
      }
      return prev;
    });
  }, []);

  // Memoized so a provider render with nothing changed doesn't re-render every consumer.
  const value = useMemo<AppContextValue>(() => ({
    photos,
    profile,
    settings,
    albums,
    today,
    isLoading,
    photosLoadFailed,
    addPhoto,
    addPhotos,
    updatePhoto,
    updatePhotos,
    deletePhoto,
    updateProfile: handleUpdateProfile,
    updateSettings: handleUpdateSettings,
    addAlbum,
    updateAlbum,
    deleteAlbum,
    resetAllData,
    seedMockPhotos,
    unlockedAlbumIds,
    unlockAlbum,
  }), [photos, profile, settings, albums, today, isLoading, photosLoadFailed, addPhoto, addPhotos, updatePhoto, updatePhotos, deletePhoto, handleUpdateProfile, handleUpdateSettings, addAlbum, updateAlbum, deleteAlbum, resetAllData, seedMockPhotos, unlockedAlbumIds, unlockAlbum]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
