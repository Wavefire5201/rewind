import React from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { AppProvider, useAppContext } from '@/context/AppContext';
import type { PhotoEntry, Album } from '@/types';
import { fileStore, deletedUris, resetFileSystemMock } from '../helpers/fileSystemMock';

jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);

type Ctx = ReturnType<typeof useAppContext>;

let ctx: Ctx | null = null;
function Probe() {
  ctx = useAppContext();
  return null;
}

async function renderProvider() {
  ctx = null;
  const utils = await render(
    <AppProvider>
      <Probe />
    </AppProvider>
  );
  await waitFor(() => expect(ctx?.isLoading).toBe(false));
  return utils;
}

function photo(overrides: Partial<PhotoEntry> = {}): PhotoEntry {
  return {
    id: `p-${Math.random().toString(36).slice(2, 8)}`,
    albumId: 'a1',
    date: '2026-03-09',
    imageUri: 'file:///document/p.jpg',
    caption: '',
    capturedAt: '2026-03-09T12:00:00.000Z',
    cameraDirection: 'front',
    ...overrides,
  };
}

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: 'a1',
    name: 'daily',
    createdAt: '2026-03-01T00:00:00.000Z',
    reminderEnabled: false,
    reminderTime: '08:00',
    isLocked: false,
    ...overrides,
  };
}

async function storedPhotos(): Promise<PhotoEntry[]> {
  return JSON.parse((await AsyncStorage.getItem('@rewind/photos')) ?? '[]');
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFileSystemMock();
  jest.clearAllMocks();
});

describe('AppContext', () => {
  // Between onboarding and the first photo (or after deleting every photo) nothing is in the
  // photos key, but the profile and settings the user chose are.
  it('loads the stored profile and settings when no photos are stored', async () => {
    await AsyncStorage.multiSet([
      ['@rewind/profile', JSON.stringify({ name: 'Ada', avatarUri: null, joinDate: '2026-03-01' })],
      ['@rewind/settings', JSON.stringify({ mirrorSelfies: false, use24hClock: true })],
      ['@rewind/albums', JSON.stringify([album()])],
    ]);
    const { unmount } = await renderProvider();
    expect(ctx!.photos).toHaveLength(0);
    expect(ctx!.profile).toEqual({ name: 'Ada', avatarUri: null, joinDate: '2026-03-01' });
    expect(ctx!.settings.mirrorSelfies).toBe(false);
    expect(ctx!.settings.use24hClock).toBe(true);

    // A change saves on top of what's stored, not on top of the defaults.
    await act(async () => {
      ctx!.updateSettings({ alignFaces: false });
    });
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem('@rewind/settings')) ?? '{}');
      expect(saved).toMatchObject({ mirrorSelfies: false, use24hClock: true, alignFaces: false });
    });
    await unmount();
  });

  it("doesn't start a new profile over one that failed to read", async () => {
    await AsyncStorage.multiSet([
      ['@rewind/photos', JSON.stringify([photo({ id: 'p1', date: '2026-03-01' })])],
      ['@rewind/profile', JSON.stringify({ name: 'Ada', avatarUri: null, joinDate: '2026-02-01' })],
    ]);
    const getItem = jest.mocked(AsyncStorage.getItem);
    const realGetItem = getItem.getMockImplementation()!;
    getItem.mockImplementation((key, ...rest) =>
      key === '@rewind/profile' ? Promise.reject(new Error('read failed')) : realGetItem(key, ...rest),
    );
    try {
      const { unmount } = await renderProvider();
      expect(ctx!.photos).toHaveLength(1);
      expect(jest.mocked(AsyncStorage.setItem).mock.calls.filter(([key]) => key === '@rewind/profile')).toEqual([]);
      await unmount();
    } finally {
      getItem.mockImplementation(realGetItem);
    }
    expect(JSON.parse((await AsyncStorage.getItem('@rewind/profile'))!).name).toBe('Ada');
  });

  it('loads persisted photos/profile/settings/albums on mount', async () => {
    await AsyncStorage.multiSet([
      ['@rewind/photos', JSON.stringify([photo({ id: 'p1' })])],
      ['@rewind/profile', JSON.stringify({ name: 'Ada', avatarUri: null, joinDate: '2026-03-01' })],
      ['@rewind/settings', JSON.stringify({ mirrorSelfies: false })],
      ['@rewind/albums', JSON.stringify([album()])],
      ['@rewind/unlocked-albums', JSON.stringify(['a1'])],
    ]);
    const { unmount } = await renderProvider();
    expect(ctx!.photos).toHaveLength(1);
    expect(ctx!.profile.name).toBe('Ada');
    expect(ctx!.settings.mirrorSelfies).toBe(false);
    expect(ctx!.albums).toHaveLength(1);
    await unmount();
  });

  it('ignores and removes unlocks saved by older versions', async () => {
    await AsyncStorage.multiSet([
      ['@rewind/albums', JSON.stringify([album({ isLocked: true })])],
      ['@rewind/unlocked-albums', JSON.stringify(['a1'])],
    ]);
    const { unmount } = await renderProvider();
    expect(ctx!.unlockedAlbumIds.has('a1')).toBe(false);
    await waitFor(async () => expect(await AsyncStorage.getItem('@rewind/unlocked-albums')).toBeNull());
    await unmount();
  });

  it("starts a new profile's join date on today's local date", async () => {
    // Only Date is faked: 20:00 on the 9th in Chicago (the test zone), already the 10th in UTC.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'hrtime', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback'] });
    jest.setSystemTime(new Date('2026-03-10T01:00:00.000Z'));
    try {
      const { unmount } = await renderProvider();
      expect(ctx!.profile.joinDate).toBe('2026-03-09');
      await unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps photos sorted by date from the moment they load', async () => {
    // Hooks rely on this order instead of re-sorting on every update.
    await AsyncStorage.setItem('@rewind/photos', JSON.stringify([
      photo({ id: 'c', date: '2026-03-10' }), photo({ id: 'a', date: '2026-03-08' }), photo({ id: 'b', date: '2026-03-09' }),
    ]));
    const { unmount } = await renderProvider();
    expect(ctx!.photos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    await unmount();
  });

  it('sorts without the locale collator (slow on Hermes; ISO dates compare as strings)', async () => {
    const collate = jest.spyOn(String.prototype, 'localeCompare');
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhotos([photo({ id: 'b', date: '2026-03-09' }), photo({ id: 'a', date: '2026-03-08' })]);
      ctx!.addPhoto(photo({ id: 'c', date: '2026-03-07' }));
    });
    await waitFor(() => expect(ctx!.photos.map((p) => p.id)).toEqual(['c', 'a', 'b']));
    expect(collate).not.toHaveBeenCalled();
    collate.mockRestore();
    await unmount();
  });

  it("doesn't hand consumers a new value when nothing in it changed", async () => {
    let renders = 0;
    const Consumer = React.memo(function Consumer() {
      renders++;
      useAppContext();
      return null;
    });
    // Re-renders the provider without changing any of its state.
    let bump = () => {};
    function Parent() {
      const [, setN] = React.useState(0);
      bump = () => setN((n) => n + 1);
      return (
        <AppProvider>
          <Consumer />
        </AppProvider>
      );
    }
    const { unmount } = await render(<Parent />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const settled = renders;
    await act(async () => bump());
    await act(async () => bump());
    expect(renders).toBe(settled);
    await unmount();
  });

  it('migrates legacy photos missing albumId', async () => {
    const legacy = { ...photo(), albumId: undefined };
    await AsyncStorage.setItem('@rewind/photos', JSON.stringify([legacy]));
    const { unmount } = await renderProvider();
    expect(ctx!.photos[0].albumId).toBe('daily-selfie');
    // Migration is written back to storage
    await waitFor(async () => {
      expect((await storedPhotos())[0].albumId).toBe('daily-selfie');
    });
    await unmount();
  });

  describe("when the stored photos can't be read", () => {
    const stored = JSON.stringify([photo({ id: 'p1', date: '2026-03-01' }), photo({ id: 'p2', date: '2026-03-02' })]);
    const getItem = jest.mocked(AsyncStorage.getItem);
    let realGetItem: NonNullable<ReturnType<typeof getItem.getMockImplementation>>;
    let errorSpy: jest.SpyInstance;
    let alertSpy: jest.SpyInstance;

    beforeEach(async () => {
      await AsyncStorage.multiSet([['@rewind/photos', stored], ['@rewind/albums', JSON.stringify([album()])]]);
      // Android: a row past the 2 MB cursor window saves but won't read back.
      realGetItem = getItem.getMockImplementation()!;
      getItem.mockImplementation((key, ...rest) =>
        key === '@rewind/photos' ? Promise.reject(new Error('Row too big to fit into CursorWindow')) : realGetItem(key, ...rest),
      );
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });
    afterEach(() => {
      getItem.mockImplementation(realGetItem);
      errorSpy.mockRestore();
      alertSpy.mockRestore();
    });

    const photoWrites = () => jest.mocked(AsyncStorage.setItem).mock.calls.filter(([key]) => key === '@rewind/photos');

    it("doesn't move the join date for photos it refused to save", async () => {
      await AsyncStorage.setItem('@rewind/profile', JSON.stringify({ name: 'Ada', avatarUri: null, joinDate: '2026-03-05' }));
      const { unmount } = await renderProvider();
      jest.mocked(AsyncStorage.setItem).mockClear();
      await act(async () => {
        ctx!.addPhotos([photo({ id: 'old', date: '2025-01-01' })]);
        ctx!.addPhoto(photo({ id: 'older', date: '2024-01-01' }));
      });
      expect(ctx!.profile.joinDate).toBe('2026-03-05');
      expect(jest.mocked(AsyncStorage.setItem).mock.calls.filter(([key]) => key === '@rewind/profile')).toEqual([]);
      await unmount();
    });

    it('opens without them, says so, and never writes over them', async () => {
      const { unmount } = await renderProvider();
      expect(ctx!.photos).toEqual([]);
      expect(ctx!.photosLoadFailed).toBe(true);
      expect(ctx!.albums).toHaveLength(1); // the rest of the data still loads
      expect(alertSpy).toHaveBeenCalledWith("Couldn't load your photos", expect.stringContaining('Nothing has been deleted'));
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');

      let updated: Promise<boolean> | undefined;
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'new', date: '2026-03-09' }));
        ctx!.addPhotos([photo({ id: 'imported', date: '2026-03-08' })]);
        updated = ctx!.updatePhotos({ p1: { caption: 'x' } });
        ctx!.seedMockPhotos('a1');
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(await updated).toBe(false);
      expect(photoWrites()).toEqual([]);
      expect(await realGetItem('@rewind/photos')).toBe(stored);
      // Refused photos aren't shown either: they'd be gone on the next launch.
      expect(ctx!.photos.filter((p) => p.id === 'new' || p.id === 'imported')).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Photos not saved'));
      await unmount();
    });

    it('saves photos again on the next launch that reads them', async () => {
      const first = await renderProvider();
      await first.unmount();
      getItem.mockImplementation(realGetItem);

      const { unmount } = await renderProvider();
      expect(ctx!.photosLoadFailed).toBe(false);
      expect(ctx!.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p3', date: '2026-03-03' }));
      });
      await waitFor(async () => expect((await storedPhotos()).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']));
      await unmount();
    });

    it('lets photos be saved again once the user clears all data', async () => {
      const { unmount } = await renderProvider();
      await act(async () => {
        await ctx!.resetAllData();
      });
      expect(ctx!.photosLoadFailed).toBe(false);
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'fresh' }));
      });
      await waitFor(async () => {
        const saved: PhotoEntry[] = JSON.parse((await realGetItem('@rewind/photos')) ?? '[]');
        expect(saved.map((p) => p.id)).toEqual(['fresh']);
      });
      await unmount();
    });
  });

  describe('when the stored photos are corrupt', () => {
    let errorSpy: jest.SpyInstance;
    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => errorSpy.mockRestore());

    it('keeps a copy, then starts over with no photos and saves normally', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await AsyncStorage.setItem('@rewind/photos', '[{"id":"p1",');
      const { unmount } = await renderProvider();
      expect(ctx!.photos).toEqual([]);
      expect(ctx!.photosLoadFailed).toBe(false);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem('@rewind/photos-corrupt-backup')).toBe('[{"id":"p1",');

      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p2' }));
      });
      await waitFor(async () => expect((await storedPhotos()).map((p) => p.id)).toEqual(['p2']));
      expect(await AsyncStorage.getItem('@rewind/photos-corrupt-backup')).toBe('[{"id":"p1",');
      alertSpy.mockRestore();
      await unmount();
    });
  });

  it("still loads legacy photos when their migration can't be written", async () => {
    // Before, the failed write left the photos out of state, so the next save replaced them.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await AsyncStorage.multiSet([
      ['@rewind/photos', JSON.stringify([{ ...photo({ id: 'old' }), albumId: undefined }])],
      ['@rewind/albums', JSON.stringify([album()])],
    ]);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    const { unmount } = await renderProvider();
    expect(ctx!.photos.map((p) => [p.id, p.albumId])).toEqual([['old', 'daily-selfie']]);
    expect(ctx!.albums).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith('Photo migration not saved:', expect.any(Error));
    errorSpy.mockRestore();
    await unmount();
  });

  it('addPhoto replaces the same date+album and persists', async () => {
    const { unmount } = await renderProvider();
    const first = photo({ id: 'p1', date: '2026-03-09' });
    const replacement = photo({ id: 'p2', date: '2026-03-09' });
    await act(async () => {
      ctx!.addPhoto(first);
      ctx!.addPhoto(replacement);
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(1));
    expect(ctx!.photos[0].id).toBe('p2');
    await waitFor(async () => {
      expect(await storedPhotos()).toHaveLength(1);
    });
    await unmount();
  });

  it('addPhotos dedups on album+date and reports honest counts', async () => {
    const { unmount } = await renderProvider();
    let r1: { added: number; skipped: number } = { added: -1, skipped: -1 };
    let r2: { added: number; skipped: number } = { added: -1, skipped: -1 };
    await act(async () => {
      r1 = ctx!.addPhotos([photo({ id: 'p1', date: '2026-03-08' }), photo({ id: 'p2', date: '2026-03-09' })]);
    });
    expect(r1).toEqual({ added: 2, skipped: 0 });
    await act(async () => {
      r2 = ctx!.addPhotos([photo({ id: 'p3', date: '2026-03-09' }), photo({ id: 'p4', date: '2026-03-10' })]);
    });
    expect(r2).toEqual({ added: 1, skipped: 1 });
    await waitFor(() => expect(ctx!.photos).toHaveLength(3));
    await unmount();
  });

  describe('join date', () => {
    async function storedJoinDate(): Promise<string | undefined> {
      return JSON.parse((await AsyncStorage.getItem('@rewind/profile')) ?? '{}').joinDate;
    }

    async function renderWith(joinDate: string, existing: PhotoEntry[]) {
      await AsyncStorage.multiSet([
        ['@rewind/photos', JSON.stringify(existing)],
        ['@rewind/profile', JSON.stringify({ name: 'Ada', avatarUri: null, joinDate })],
      ]);
      return renderProvider();
    }

    it('moves back to the earliest photo a backup restore adds, so the camera does not say "day 1"', async () => {
      // A fresh install starts the join date today; the backup holds older photos, in any order.
      const { unmount } = await renderProvider();
      expect(ctx!.profile.joinDate > '2025-03-10').toBe(true);
      await act(async () => {
        ctx!.addPhotos([
          photo({ id: 'p2', date: '2025-06-01' }),
          photo({ id: 'p1', date: '2025-03-10' }),
          photo({ id: 'p3', date: '2025-09-01' }),
        ]);
      });
      expect(ctx!.profile.joinDate).toBe('2025-03-10');
      await waitFor(async () => expect(await storedJoinDate()).toBe('2025-03-10'));
      await unmount();
    });

    it('counts only the photos addPhotos adds, not the ones it skips', async () => {
      // A photo from before the join date already on 03-01 (restored before this was fixed):
      // the skipped copy of it doesn't count, the new 03-05 does.
      const { unmount } = await renderWith('2026-03-10', [photo({ id: 'old', date: '2026-03-01' })]);
      await act(async () => {
        ctx!.addPhotos([photo({ id: 'dupe', date: '2026-03-01' }), photo({ id: 'new', date: '2026-03-05' })]);
      });
      expect(ctx!.profile.joinDate).toBe('2026-03-05');
      await waitFor(async () => expect(await storedJoinDate()).toBe('2026-03-05'));
      await unmount();
    });

    it('stays put, without a profile write, when nothing earlier is added', async () => {
      const { unmount } = await renderWith('2026-03-01', [photo({ id: 'old', date: '2026-03-01' })]);
      const setItem = jest.mocked(AsyncStorage.setItem);
      setItem.mockClear();
      await act(async () => {
        ctx!.addPhotos([photo({ id: 'later', date: '2026-03-09' })]);
        ctx!.addPhotos([photo({ id: 'dupe', date: '2026-03-01' })]);
        ctx!.addPhoto(photo({ id: 'today', date: '2026-03-10' }));
      });
      await waitFor(async () => expect(await storedPhotos()).toHaveLength(3));
      expect(ctx!.profile.joinDate).toBe('2026-03-01');
      expect(setItem.mock.calls.filter(([key]) => key === '@rewind/profile')).toHaveLength(0);
      await unmount();
    });

    it('moves back for a single photo added on an earlier day too', async () => {
      const { unmount } = await renderWith('2026-03-10', [photo({ id: 'p1', date: '2026-03-10' })]);
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p0', date: '2026-03-02' }));
      });
      expect(ctx!.profile.joinDate).toBe('2026-03-02');
      await waitFor(async () => expect(await storedJoinDate()).toBe('2026-03-02'));
      await unmount();
    });

    it('keeps the earlier join date in state when its save fails (log + haptic, no throw)', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = await renderWith('2026-03-10', [photo({ id: 'p1', date: '2026-03-10' })]);
      const setItem = jest.mocked(AsyncStorage.setItem);
      const realSetItem = setItem.getMockImplementation()!;
      setItem.mockImplementation((key, value) =>
        key === '@rewind/profile' ? Promise.reject(new Error('disk full')) : realSetItem(key, value),
      );
      try {
        await act(async () => {
          ctx!.addPhotos([photo({ id: 'p0', date: '2026-03-02' })]);
        });
        await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Storage write failed:', expect.any(Error)));
        expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
        expect(ctx!.profile.joinDate).toBe('2026-03-02');
        expect(ctx!.photos.map((p) => p.id)).toEqual(['p0', 'p1']);
      } finally {
        setItem.mockImplementation(realSetItem);
        errorSpy.mockRestore();
      }
      await unmount();
    });
  });

  it('deletePhoto removes state, storage, and the local file (not remote)', async () => {
    fileStore.set('file:///document/p.jpg', 'QUJD');
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhoto(photo({ id: 'p1', date: '2026-03-09', imageUri: 'file:///document/p.jpg' }));
      ctx!.addPhoto(photo({ id: 'p2', date: '2026-03-10', imageUri: 'https://remote/x.jpg' }));
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(2));

    await act(async () => {
      ctx!.deletePhoto('p1');
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setImmediate(r)); // file deletion is deferred
    });
    expect(deletedUris).toContain('file:///document/p.jpg');

    await act(async () => {
      ctx!.deletePhoto('p2');
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(0));
    await act(async () => {
      await new Promise((r) => setImmediate(r));
    });
    expect(deletedUris).not.toContain('https://remote/x.jpg');
    await unmount();
  });

  describe('photo files', () => {
    let errorSpy: jest.SpyInstance;
    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => errorSpy.mockRestore());

    it('deletePhoto keeps the file when the save fails, so the entry still has its photo', async () => {
      fileStore.set('file:///document/p.jpg', 'QUJD');
      const { unmount } = await renderProvider();
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p1', imageUri: 'file:///document/p.jpg' }));
      });
      await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));

      jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
      await act(async () => {
        ctx!.deletePhoto('p1');
      });
      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Storage write failed:', expect.any(Error)));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(deletedUris).not.toContain('file:///document/p.jpg');
      await unmount();
    });

    it('deleteAlbum keeps its files when the save fails', async () => {
      fileStore.set('file:///document/b.jpg', 'QUJD');
      const { unmount } = await renderProvider();
      await act(async () => {
        ctx!.addAlbum(album({ id: 'a1' }));
        ctx!.addAlbum(album({ id: 'a2' }));
        ctx!.addPhoto(photo({ id: 'p1', albumId: 'a2', imageUri: 'file:///document/b.jpg' }));
      });
      await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));

      // Both saves fail: the albums and the photos.
      jest.mocked(AsyncStorage.setItem)
        .mockRejectedValueOnce(new Error('disk full'))
        .mockRejectedValueOnce(new Error('disk full'));
      await act(async () => {
        ctx!.deleteAlbum('a2');
      });
      await waitFor(() => expect(errorSpy).toHaveBeenCalled());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(deletedUris).not.toContain('file:///document/b.jpg');
      await unmount();
    });

    it("deletePhoto deletes the photo's thumbnail too", async () => {
      fileStore.set('file:///document/p.jpg', 'QUJD');
      fileStore.set('file:///document/p_thumb.jpg', 'dGg=');
      const { unmount } = await renderProvider();
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p1', imageUri: 'file:///document/p.jpg', thumbUri: 'file:///document/p_thumb.jpg' }));
      });
      await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));
      await act(async () => {
        ctx!.deletePhoto('p1');
      });
      await waitFor(() => expect(deletedUris).toEqual(expect.arrayContaining(['file:///document/p.jpg', 'file:///document/p_thumb.jpg'])));
      await unmount();
    });

    it("addPhoto deletes the replaced photo's file once the replacement is saved", async () => {
      fileStore.set('file:///document/old.jpg', 'QUJD');
      fileStore.set('file:///document/new.jpg', 'QUJD');
      const { unmount } = await renderProvider();
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p1', date: '2026-03-09', imageUri: 'file:///document/old.jpg' }));
      });
      await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));
      await act(async () => {
        ctx!.addPhoto(photo({ id: 'p2', date: '2026-03-09', imageUri: 'file:///document/new.jpg' }));
      });
      await waitFor(() => expect(deletedUris).toContain('file:///document/old.jpg'));
      expect(deletedUris).not.toContain('file:///document/new.jpg');
      await unmount();
    });

    it('addPhotos deletes the files of the entries it skips, but never a file still in use', async () => {
      fileStore.set('file:///document/kept.jpg', 'QUJD');
      fileStore.set('file:///document/dupe.jpg', 'QUJD');
      const { unmount } = await renderProvider();
      const kept = photo({ id: 'p1', date: '2026-03-09', imageUri: 'file:///document/kept.jpg' });
      await act(async () => {
        ctx!.addPhotos([kept]);
      });
      await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));
      await act(async () => {
        // A fresh copy for a day that already has a photo, and the same entry again.
        ctx!.addPhotos([photo({ id: 'p2', date: '2026-03-09', imageUri: 'file:///document/dupe.jpg' }), kept]);
      });
      await waitFor(() => expect(deletedUris).toContain('file:///document/dupe.jpg'));
      expect(deletedUris).not.toContain('file:///document/kept.jpg');
      await unmount();
    });
  });

  it('updatePhoto / updateProfile / updateSettings persist', async () => {
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhoto(photo({ id: 'p1', caption: 'old' }));
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(1));
    await act(async () => {
      ctx!.updatePhoto('p1', { caption: 'new' });
      ctx!.updateProfile({ name: 'Grace' });
      ctx!.updateSettings({ use24hClock: true });
    });
    await waitFor(() => expect(ctx!.photos[0].caption).toBe('new'));
    expect(ctx!.profile.name).toBe('Grace');
    expect(ctx!.settings.use24hClock).toBe(true);
    await waitFor(async () => {
      expect((await storedPhotos())[0].caption).toBe('new');
    });
    await unmount();
  });

  it('updatePhotos patches several photos with a single save and ignores unknown ids', async () => {
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhotos([
        photo({ id: 'p1', date: '2026-03-08' }),
        photo({ id: 'p2', date: '2026-03-09' }),
        photo({ id: 'p3', date: '2026-03-10' }),
      ]);
    });
    await waitFor(async () => expect(await storedPhotos()).toHaveLength(3));

    const setItem = jest.mocked(AsyncStorage.setItem);
    setItem.mockClear();
    await act(async () => {
      // 'gone' = a photo deleted while its face scan was in flight
      ctx!.updatePhotos({ p1: { caption: 'one' }, p3: { caption: 'three' }, gone: { caption: 'x' } });
    });

    await waitFor(async () =>
      expect((await storedPhotos()).map((p) => p.caption)).toEqual(['one', '', 'three']),
    );
    expect(setItem.mock.calls.filter(([key]) => key === '@rewind/photos')).toHaveLength(1);
    expect(ctx!.photos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    await unmount();
  });

  it('reports a failed save (log + error haptic) and keeps saving afterwards', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhoto(photo({ id: 'p1', caption: 'old' }));
    });
    await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));

    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    await act(async () => {
      ctx!.updatePhoto('p1', { caption: 'lost' });
    });
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Storage write failed:', expect.any(Error)));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');

    await act(async () => {
      ctx!.updatePhoto('p1', { caption: 'saved' });
    });
    await waitFor(async () => expect((await storedPhotos())[0].caption).toBe('saved'));
    errorSpy.mockRestore();
    await unmount();
  });

  it('updatePhotos resolves true once the patch is on disk, so callers can act on it safely', async () => {
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhoto(photo({ id: 'p1', imageUri: 'file:///document/a.jpg' }));
    });
    // Await outside act(): inside it React holds the render that runs the update.
    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = ctx!.updatePhotos({ p1: { imageUri: 'file:///document/a_q95.jpg' } });
    });
    expect(await pending).toBe(true);
    expect((await storedPhotos())[0].imageUri).toBe('file:///document/a_q95.jpg');
    await unmount();
  });

  it('updatePhotos resolves false when the save fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhoto(photo({ id: 'p1' }));
    });
    await waitFor(async () => expect(await storedPhotos()).toHaveLength(1));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = ctx!.updatePhotos({ p1: { caption: 'x' } });
    });
    expect(await pending).toBe(false);
    errorSpy.mockRestore();
    await unmount();
  });

  it('writes a burst of photo changes as one or two saves, with every change in the last', async () => {
    // Each save writes the whole array (~1 MB at 1000 photos); the in-between states
    // are never read back, so only the newest needs writing.
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addPhotos(Array.from({ length: 10 }, (_, i) => photo({ id: `p${i}`, date: `2026-03-${String(i + 1).padStart(2, '0')}` })));
    });
    await waitFor(async () => expect(await storedPhotos()).toHaveLength(10));
    const setItem = jest.mocked(AsyncStorage.setItem);
    setItem.mockClear();
    const results: Promise<boolean>[] = [];
    await act(async () => {
      for (let i = 0; i < 10; i++) results.push(ctx!.updatePhotos({ [`p${i}`]: { caption: `c${i}` } }));
    });
    expect(await Promise.all(results)).toEqual(Array(10).fill(true));
    const writes = setItem.mock.calls.filter(([key]) => key === '@rewind/photos');
    expect(writes.length).toBeLessThanOrEqual(2);
    expect((await storedPhotos()).map((p) => p.caption)).toEqual(Array.from({ length: 10 }, (_, i) => `c${i}`));
    await unmount();
  });

  it('updatePhotos with no patches does not write photos', async () => {
    const { unmount } = await renderProvider();
    const setItem = jest.mocked(AsyncStorage.setItem);
    setItem.mockClear();
    await act(async () => {
      ctx!.updatePhotos({});
    });
    expect(setItem.mock.calls.filter(([key]) => key === '@rewind/photos')).toHaveLength(0);
    await unmount();
  });

  it('manages albums: add/update/delete with single-album guard', async () => {
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addAlbum(album({ id: 'a1' }));
      ctx!.addAlbum(album({ id: 'a2', name: 'two' }));
    });
    await waitFor(() => expect(ctx!.albums).toHaveLength(2));

    await act(async () => {
      ctx!.updateAlbum('a2', { name: 'TWO' });
    });
    await waitFor(() => expect(ctx!.albums.find((a) => a.id === 'a2')!.name).toBe('TWO'));

    await act(async () => {
      ctx!.addPhoto(photo({ id: 'p1', albumId: 'a2' }));
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(1));
    await act(async () => {
      ctx!.deleteAlbum('a2');
    });
    await waitFor(() => expect(ctx!.albums).toHaveLength(1));
    await waitFor(() => expect(ctx!.photos).toHaveLength(0));
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('album-reminder-a2');

    // Last album is protected
    await act(async () => {
      ctx!.deleteAlbum('a1');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(ctx!.albums).toHaveLength(1);
    await unmount();
  });

  describe('album unlocks', () => {
    async function renderWithUnlockedAlbum() {
      const utils = await renderProvider();
      await act(async () => {
        ctx!.addAlbum(album({ id: 'a1', isLocked: true }));
        ctx!.addAlbum(album({ id: 'a2', isLocked: true }));
      });
      await waitFor(() => expect(ctx!.albums).toHaveLength(2));
      await act(async () => {
        ctx!.unlockAlbum('a1');
      });
      expect(ctx!.unlockedAlbumIds.has('a1')).toBe(true);
      return utils;
    }

    it('last only for this session: a remount starts locked and nothing is saved', async () => {
      const first = await renderWithUnlockedAlbum();
      await first.unmount();
      expect(await AsyncStorage.getItem('@rewind/unlocked-albums')).toBeNull();

      const second = await renderProvider();
      expect(ctx!.unlockedAlbumIds.has('a1')).toBe(false);
      await second.unmount();
    });

    it('locking an album again drops its unlock', async () => {
      const { unmount } = await renderWithUnlockedAlbum();
      await act(async () => {
        ctx!.updateAlbum('a1', { isLocked: false });
      });
      await act(async () => {
        ctx!.updateAlbum('a1', { isLocked: true });
      });
      expect(ctx!.unlockedAlbumIds.has('a1')).toBe(false);
      await unmount();
    });

    it('deleting an album drops its unlock', async () => {
      const { unmount } = await renderWithUnlockedAlbum();
      await act(async () => {
        ctx!.deleteAlbum('a1');
      });
      expect(ctx!.unlockedAlbumIds.has('a1')).toBe(false);
      await unmount();
    });

    it('re-lock after more than a minute in the background, but survive a short trip', async () => {
      const listeners: ((state: AppStateStatus) => void)[] = [];
      // Put the react-native mock's own implementation back afterwards (mockRestore on it
      // would strip it, breaking every later unmount).
      const addListener = jest.mocked(AppState.addEventListener);
      const original = addListener.getMockImplementation();
      addListener.mockImplementation((_type, listener) => {
        listeners.push(listener as (state: AppStateStatus) => void);
        return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
      });
      const now = jest.spyOn(Date, 'now');
      const { unmount } = await renderWithUnlockedAlbum();
      const emit = (state: AppStateStatus) => act(async () => listeners.forEach((l) => l(state)));

      // A picker or share sheet: back within the minute, still unlocked.
      now.mockReturnValue(1_000_000);
      await emit('background');
      now.mockReturnValue(1_000_000 + 30_000);
      await emit('active');
      expect(ctx!.unlockedAlbumIds.has('a1')).toBe(true);

      now.mockReturnValue(2_000_000);
      await emit('background');
      now.mockReturnValue(2_000_000 + 61_000);
      await emit('active');
      expect(ctx!.unlockedAlbumIds.has('a1')).toBe(false);

      now.mockRestore();
      await unmount();
      addListener.mockImplementation(original);
    });
  });

  it('resetAllData clears state, storage, and local files', async () => {
    fileStore.set('file:///document/p.jpg', 'QUJD');
    fileStore.set('file:///document/p_thumb.jpg', 'dGg=');
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.addAlbum(album({ id: 'a1' }));
      ctx!.addPhoto(photo({ id: 'p1', imageUri: 'file:///document/p.jpg', thumbUri: 'file:///document/p_thumb.jpg' }));
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(1));

    await act(async () => {
      await ctx!.resetAllData();
    });
    expect(ctx!.photos).toEqual([]);
    expect(ctx!.albums).toEqual([]);
    expect(await AsyncStorage.getItem('@rewind/photos')).toBeNull();
    expect(deletedUris).toContain('file:///document/p.jpg');
    expect(deletedUris).toContain('file:///document/p_thumb.jpg');
    // The deleted albums' daily reminders must stop too.
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    await unmount();
  });

  it('seedMockPhotos generates a 7-day run without clobbering', async () => {
    const { unmount } = await renderProvider();
    await act(async () => {
      ctx!.seedMockPhotos('a1');
    });
    await waitFor(() => expect(ctx!.photos).toHaveLength(7));
    const dates = new Set(ctx!.photos.map((p) => p.date));
    expect(dates.size).toBe(7);
    // Seeding twice does not duplicate
    await act(async () => {
      ctx!.seedMockPhotos('a1');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(ctx!.photos).toHaveLength(7);
    await unmount();
  });
});
