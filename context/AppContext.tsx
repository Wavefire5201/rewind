import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import { File } from 'expo-file-system';
import type { PhotoEntry, UserProfile, AppSettings, Album } from '@/types';
import { loadAll, savePhotos, saveProfile, saveSettings, saveAlbums, clearAllData, getDefaultSettings, type StoredData } from '@/utils/storage';
import { USE_MOCK_DATA, MOCK_PHOTOS, MOCK_PROFILE, MOCK_SETTINGS } from '@/constants/mockData';
import { cancelAlbumReminder, cancelAllReminders } from '@/utils/notifications';
import { notify } from '@/utils/notify';
import { useToday } from '@/hooks/useToday';
import { getToday, byDate } from '@/utils/dates';

// Saves go through utils/storage, which writes only the rows a change touched, in one
// transaction per tick, and reports a failure itself (log + notice). Each save resolves with
// whether it reached storage.

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
  const [unlockedAlbumIds, setUnlockedAlbumIds] = useState<Set<string>>(new Set());
  const today = useToday();

  // Synchronous mirror of `photos` for event handlers that must compute against
  // current state (e.g. addPhotos dedup counts). setState updaters run
  // asynchronously, so counting inside an updater makes the returned counts
  // depend on React's eager-evaluation timing — this ref is always fresh.
  const photosRef = useRef<PhotoEntry[]>([]);
  photosRef.current = photos;
  // Mirrors for resetAllData to put back if its clear fails.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Albums change only on user actions, each computed from this list and setting it at once
  // (not at the next render), so changes made before a render build on each other, and a
  // delete can save the albums together with its photos (see deleteAlbum).
  const albumsRef = useRef<Album[]>(DEFAULT_ALBUMS);
  const setAlbumsNow = useCallback((next: Album[]) => {
    albumsRef.current = next;
    setAlbums(next);
  }, []);

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
      let stored: StoredData;
      try {
        stored = await loadAll();
      } catch (e) {
        // Nothing loaded, but nothing is lost: a save writes only the rows it changes, so the
        // stored photos stay put until a launch that can read them.
        console.error('Failed to load app data:', e);
        notify({
          title: "couldn't load your photos",
          message: "nothing has been deleted, but rewind couldn't read your saved photos. try restarting the app.",
          tone: 'error',
          sticky: true,
          key: 'photos-load-failed',
        });
        setIsLoading(false);
        return;
      }

      // The profile and settings load whatever the photo count: between onboarding and the
      // first photo, or after deleting every photo, there are none but these are stored.
      if (stored.profile) setProfile(stored.profile);
      setSettings(stored.settings);

      if (stored.photos.length > 0) {
        // In date order from storage and kept that way (every add sorts), so hooks never re-sort.
        setPhotos(stored.photos);
        // No profile stored: start one, joined on the earliest photo.
        if (!stored.profile) {
          const derivedProfile: UserProfile = { ...newProfile(), joinDate: stored.photos[0].date };
          setProfile(derivedProfile);
          void saveProfile(derivedProfile);
        }
      } else if (USE_MOCK_DATA) {
        // Seed with mock data on first launch
        setPhotos(MOCK_PHOTOS);
        setProfile(MOCK_PROFILE);
        setSettings(MOCK_SETTINGS);
        void savePhotos(MOCK_PHOTOS);
        void saveProfile(MOCK_PROFILE);
        void saveSettings(MOCK_SETTINGS);
      }

      if (stored.albums.length > 0) {
        setAlbumsNow(stored.albums);
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
        setAlbumsNow([mockAlbum]);
        void saveAlbums([mockAlbum]);
      }
      setIsLoading(false);
    }
    init();
  }, [setAlbumsNow]);

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
        // An updater can run twice (StrictMode); both saves share a flush.
        savePhotos(next).then(resolve);
        return next;
      });
    });
  }, []);

  // The join date can't be later than a photo the user has: adding older photos (a backup
  // restore, a camera-roll import, a past day filled in) moves it back to the earliest of
  // them. The camera's "day N" counts from it.
  const moveJoinDateBack = useCallback((dates: string[]) => {
    if (dates.length === 0) return;
    const earliest = dates.reduce((a, b) => (b < a ? b : a));
    setProfile(prev => {
      if (prev.joinDate && prev.joinDate <= earliest) return prev;
      const next = { ...prev, joinDate: earliest };
      void saveProfile(next);
      return next;
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
    moveJoinDateBack([entry.date]);
  }, [commitPhotos, moveJoinDateBack]);

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
      // Skipped entries don't count. One the re-check above drops still has its day covered
      // by the photo already there, so every date here ends up in the album.
      moveJoinDateBack(toAdd.map(e => e.date));
    }
    return { added: toAdd.length, skipped: skipped.length };
  }, [commitPhotos, moveJoinDateBack]);

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
      void saveProfile(next);
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      void saveSettings(next);
      return next;
    });
  }, []);

  const addAlbum = useCallback((album: Album) => {
    const next = [...albumsRef.current, album];
    setAlbumsNow(next);
    void saveAlbums(next);
  }, [setAlbumsNow]);

  const updateAlbum = useCallback((id: string, updates: Partial<Album>) => {
    const next = albumsRef.current.map(a => a.id === id ? { ...a, ...updates } : a);
    setAlbumsNow(next);
    void saveAlbums(next);
    // Locking an album again must take effect, not ride on an earlier unlock.
    if (updates.isLocked === true) forgetUnlock(id);
  }, [setAlbumsNow, forgetUnlock]);

  const deleteAlbum = useCallback((id: string) => {
    if (albumsRef.current.length <= 1) return;
    const nextAlbums = albumsRef.current.filter(a => a.id !== id);
    setAlbumsNow(nextAlbums);
    cancelAlbumReminder(id);
    forgetUnlock(id);
    // The album and its photos save in the same tick, so they share one transaction: both go or
    // neither. Both saves are requested from the photo updater, which React may run now or at
    // the next render; saving the album from its own updater could land a flush apart.
    let removed: PhotoEntry[] = [];
    new Promise<boolean>((resolve) => {
      setPhotos(prev => {
        void saveAlbums(nextAlbums);
        removed = prev.filter(p => p.albumId === id);
        if (removed.length === 0) {
          resolve(true);
          return prev;
        }
        const next = prev.filter(p => p.albumId !== id);
        savePhotos(next).then(resolve);
        return next;
      });
    }).then(saved => {
      if (saved) deleteUnreferencedFiles(removed, photosRef.current);
    });
  }, [setAlbumsNow, forgetUnlock]);

  const resetAllData = useCallback(async () => {
    const before = { photos: photosRef.current, albums: albumsRef.current, profile: profileRef.current, settings: settingsRef.current };
    // Emptied in the same tick as the clear, so a change made meanwhile (a backfill's batch, say)
    // builds on the empty app and can't write the old rows back.
    const cleared = clearAllData();
    setPhotos([]);
    setAlbumsNow([]);
    setProfile(newProfile());
    setSettings(getDefaultSettings());
    if (!(await cleared)) {
      // Every row is still stored (storage has said so): show them again, and keep their files.
      setPhotos(before.photos);
      setAlbumsNow(before.albums);
      setProfile(before.profile);
      setSettings(before.settings);
      return;
    }
    setUnlockedAlbumIds(new Set());
    for (const uri of new Set(before.photos.flatMap(filesOf))) {
      if (!uri?.startsWith('file://')) continue;
      try { new File(uri).delete(); } catch {}
    }
    // The albums are gone, so are their reminders.
    await cancelAllReminders();
  }, [setAlbumsNow]);

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
      void savePhotos(next);
      return next;
    });

    const earliest = mockPhotos[mockPhotos.length - 1].date;
    setProfile(prev => {
      if (!prev.joinDate || earliest < prev.joinDate) {
        const next = { ...prev, joinDate: earliest };
        void saveProfile(next);
        return next;
      }
      return prev;
    });

    const earliestISO = new Date(earliest + 'T00:00:00').toISOString();
    const prevAlbums = albumsRef.current;
    const updated = prevAlbums.map(a => {
      if (a.id === resolvedAlbumId && a.createdAt > earliestISO) {
        return { ...a, createdAt: earliestISO };
      }
      return a;
    });
    if (updated.some((a, i) => a !== prevAlbums[i])) {
      setAlbumsNow(updated);
      void saveAlbums(updated);
    }
  }, [setAlbumsNow]);

  // Memoized so a provider render with nothing changed doesn't re-render every consumer.
  const value = useMemo<AppContextValue>(() => ({
    photos,
    profile,
    settings,
    albums,
    today,
    isLoading,
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
  }), [photos, profile, settings, albums, today, isLoading, addPhoto, addPhotos, updatePhoto, updatePhotos, deletePhoto, handleUpdateProfile, handleUpdateSettings, addAlbum, updateAlbum, deleteAlbum, resetAllData, seedMockPhotos, unlockedAlbumIds, unlockAlbum]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
